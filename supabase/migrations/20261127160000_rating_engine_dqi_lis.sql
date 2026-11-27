-- Leatha rating engine per Leatha_Rating_System_Reference.docx
--   DQI  = min(10, (N0*mu0 + S) / (N0 + W)), S/W decayed incrementally (half-life 30d)
--   LIS  = sum_k w_k * log10(1 + count_k), count_k = sum of trust weights; monotonic
--   tau  = tau_account * tau_relationship * tau_velocity * tau_plausibility
--   tau = 0 dropped; 0 < tau < 0.4 pending buffer; tau >= 0.4 applied with weight v*tau
--   circuit breaker: one rater moves a creator's DQI by at most 0.3 / 24h
-- Runs entirely in Postgres (SECURITY DEFINER, not callable by clients), fed by triggers,
-- so events cannot be forged from the browser.

-- ---------- schema ----------
ALTER TABLE public.creator_rating_state
  ADD COLUMN IF NOT EXISTS dqi_s numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dqi_w numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dqi_sigma numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lis_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tier integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_decay_at timestamptz NOT NULL DEFAULT now();
-- brand-new creators start at the prior (mu0 = 7.0), not 0
ALTER TABLE public.creator_rating_state ALTER COLUMN dqi_x SET DEFAULT 7.0;

ALTER TABLE public.rating_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'applied'
    CHECK (status IN ('applied','pending','dropped','capped')),
  ADD COLUMN IF NOT EXISTS event_weight numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS dqi_delta numeric NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_rating_events_rater ON public.rating_events(user_id, creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rating_events_pending ON public.rating_events(created_at) WHERE status = 'pending';

-- ---------- parameters ----------
CREATE OR REPLACE FUNCTION public.rating_param(p text) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p
    WHEN 'half_life_days' THEN 30 WHEN 'n0' THEN 20 WHEN 'mu0' THEN 7.0
    WHEN 'sigma_q' THEN 2.0 WHEN 'tier_base' THEN 2.5 WHEN 'breaker' THEN 0.3
    WHEN 'trust_pending' THEN 0.4 END
$$;

-- LIS weight per contribution type (doc 4.3); NULL = does not count toward LIS
CREATE OR REPLACE FUNCTION public.rating_lis_weight(t text) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE t
    WHEN 'fork_received' THEN 3.0 WHEN 'content_publish' THEN 2.0 WHEN 'answer' THEN 1.5
    WHEN 'mentorship' THEN 1.5 WHEN 'rating' THEN 1.0 WHEN 'arena' THEN 1.0
    WHEN 'fork_given' THEN 1.0 WHEN 'quiz_improvement' THEN 0.8 WHEN 'login' THEN 0.5 END
$$;

-- DQI event size v_e (doc 3); NULL = event type does not carry a quality signal
CREATE OR REPLACE FUNCTION public.rating_dqi_weight(t text) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE t WHEN 'rating' THEN 1.0 WHEN 'quiz_improvement' THEN 0.6 WHEN 'fork_received' THEN 0.4 END
$$;

-- ---------- trust layer (doc section 2) ----------
CREATE OR REPLACE FUNCTION public.rating_trust(p_rater uuid, p_creator uuid, p_type text, p_exclude uuid DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_age numeric; v_verified boolean := false; v_recip integer; v_burst integer;
  t_acc numeric; t_rel numeric; t_vel numeric; t_pla numeric := 1;
BEGIN
  SELECT EXTRACT(EPOCH FROM (now() - u.created_at)) / 86400.0,
         (u.email_confirmed_at IS NOT NULL) OR COALESCE(p.is_verified, false)
    INTO v_age, v_verified
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = p_rater;
  IF v_age IS NULL THEN RETURN 0; END IF;

  -- tau_account = 0.5 + 0.5 * min(1, age/90) * verified
  t_acc := 0.5 + 0.5 * LEAST(1, v_age / 90.0) * (CASE WHEN v_verified THEN 1 ELSE 0 END);

  -- tau_relationship: reciprocal "scratch my back" events creator -> rater in last 30d
  SELECT count(*) INTO v_recip FROM public.rating_events
   WHERE user_id = p_creator AND creator_id = p_rater AND status = 'applied'
     AND created_at > now() - interval '30 days';
  t_rel := exp(-0.35 * v_recip);

  -- tau_velocity: bursts of events by this rater in 10 minutes (z-score proxy: >5 is unusual)
  SELECT count(*) INTO v_burst FROM public.rating_events
   WHERE user_id = p_rater AND created_at > now() - interval '10 minutes'
     AND id IS DISTINCT FROM p_exclude;
  t_vel := exp(-0.15 * GREATEST(0, v_burst - 5));

  -- tau_plausibility: identical event for the same pair inside 60s is a replay
  IF EXISTS (SELECT 1 FROM public.rating_events
              WHERE user_id = p_rater AND creator_id = p_creator AND event_type = p_type
                AND created_at > now() - interval '60 seconds' AND id IS DISTINCT FROM p_exclude) THEN
    t_pla := 0;
  END IF;

  RETURN round((t_acc * t_rel * t_vel * t_pla)::numeric, 4);
END $$;

-- ---------- effect of one trusted event on DQI + LIS ----------
CREATE OR REPLACE FUNCTION public._apply_rating_effect(p_event uuid, p_tau numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev public.rating_events%ROWTYPE; st public.creator_rating_state%ROWTYPE;
  v numeric; eff numeric; lam numeric; dt numeric; s numeric; w numeric;
  dqi_old numeric; dqi_new numeric; used numeric; k text; w_k numeric;
  c_old numeric; c_new numeric; counts jsonb; lis_inc numeric := 0; lis_new numeric;
BEGIN
  SELECT * INTO ev FROM public.rating_events WHERE id = p_event;
  INSERT INTO public.creator_rating_state (creator_id) VALUES (ev.creator_id) ON CONFLICT DO NOTHING;
  SELECT * INTO st FROM public.creator_rating_state WHERE creator_id = ev.creator_id FOR UPDATE;

  v := public.rating_dqi_weight(ev.event_type);
  lam := ln(2) / public.rating_param('half_life_days');
  dt := GREATEST(0, EXTRACT(EPOCH FROM (now() - st.last_decay_at)) / 86400.0);
  -- decay running totals by the gap since the last update only (doc 3.5)
  s := st.dqi_s * exp(-lam * dt);
  w := st.dqi_w * exp(-lam * dt);
  dqi_old := LEAST(10, (public.rating_param('n0') * public.rating_param('mu0') + s) / (public.rating_param('n0') + w));
  dqi_new := dqi_old;

  -- DQI path: only genuine third-party ratings; self events never move quality
  IF v IS NOT NULL AND ev.user_id <> ev.creator_id THEN
    eff := v * p_tau;
    dqi_new := LEAST(10, (public.rating_param('n0') * public.rating_param('mu0') + s + eff * ev.quality_value)
                          / (public.rating_param('n0') + w + eff));
    -- circuit breaker: a single rater may move this creator's DQI by <= 0.3 per 24h
    SELECT COALESCE(sum(abs(dqi_delta)), 0) INTO used FROM public.rating_events
     WHERE user_id = ev.user_id AND creator_id = ev.creator_id AND status = 'applied'
       AND created_at > now() - interval '24 hours';
    IF used + abs(dqi_new - dqi_old) > public.rating_param('breaker') THEN
      UPDATE public.rating_events SET status = 'capped', trust_tau = p_tau WHERE id = p_event;
      RETURN;
    END IF;
    s := s + eff * ev.quality_value;
    w := w + eff;
  END IF;

  -- LIS path: count_k += tau (trust-weighted), LIS only ever increases
  counts := st.lis_counts;
  k := ev.event_type;
  w_k := public.rating_lis_weight(k);
  IF w_k IS NOT NULL THEN
    c_old := COALESCE((counts ->> k)::numeric, 0);
    c_new := c_old + p_tau;
    counts := jsonb_set(counts, ARRAY[k], to_jsonb(c_new), true);
    lis_inc := w_k * (log(1 + c_new) - log(1 + c_old));
  END IF;
  lis_new := st.lis_total + GREATEST(0, lis_inc);

  UPDATE public.rating_events SET status = 'applied', trust_tau = p_tau, event_weight = COALESCE(v, 0),
         dqi_delta = dqi_new - dqi_old, dqi_after = dqi_new WHERE id = p_event;

  UPDATE public.creator_rating_state SET
    dqi_s = s, dqi_w = w, dqi_x = dqi_new,
    dqi_sigma = public.rating_param('sigma_q') / sqrt(w + 1),   -- N_eff = W
    lis_counts = counts, lis_total = lis_new,
    active_lis = COALESCE((
      SELECT sum(public.rating_lis_weight(t) * log(1 + c)) FROM (
        SELECT event_type AS t, sum(trust_tau) AS c FROM public.rating_events
         WHERE creator_id = ev.creator_id AND status = 'applied' AND created_at > now() - interval '365 days'
           AND public.rating_lis_weight(event_type) IS NOT NULL GROUP BY event_type) x), 0),
    tier = floor(ln(1 + lis_new) / ln(public.rating_param('tier_base')))::int,
    last_decay_at = now(), last_event_at = now(), updated_at = now(),
    engine_state = jsonb_build_object('model', 'dqi-bayes-decay-v1', 'S', s, 'W', w)
  WHERE creator_id = ev.creator_id;

END $$;

-- ---------- entry point used by triggers / service role ----------
CREATE OR REPLACE FUNCTION public.record_rating_event(
  p_creator uuid, p_rater uuid, p_type text, p_quality numeric DEFAULT 0)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_tau numeric; v_q numeric := LEAST(10, GREATEST(0, COALESCE(p_quality, 0)));
BEGIN
  IF p_creator IS NULL OR p_rater IS NULL THEN RETURN 'ignored'; END IF;
  IF public.rating_lis_weight(p_type) IS NULL AND public.rating_dqi_weight(p_type) IS NULL THEN
    RAISE EXCEPTION 'Unknown rating event type %', p_type;
  END IF;
  INSERT INTO public.rating_events (creator_id, user_id, event_type, quality_value, status)
  VALUES (p_creator, p_rater, p_type, v_q, 'pending') RETURNING id INTO v_id;

  v_tau := public.rating_trust(p_rater, p_creator, p_type, v_id);
  IF v_tau <= 0 THEN
    UPDATE public.rating_events SET status = 'dropped', trust_tau = 0 WHERE id = v_id;
    RETURN 'dropped';
  ELSIF v_tau < public.rating_param('trust_pending') THEN
    UPDATE public.rating_events SET trust_tau = v_tau WHERE id = v_id;  -- stays pending
    RETURN 'pending';
  END IF;
  PERFORM public._apply_rating_effect(v_id, v_tau);
  RETURN (SELECT status FROM public.rating_events WHERE id = v_id);
END $$;

-- Nightly re-check of the pending buffer (doc 2.3 / 5.1 step 14): promote if trust recovered,
-- discard after 14 days otherwise. Call daily (pg_cron / scheduled edge function).
CREATE OR REPLACE FUNCTION public.recheck_pending_rating_events()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_tau numeric; n integer := 0;
BEGIN
  FOR r IN SELECT id, user_id, creator_id, event_type, created_at FROM public.rating_events
            WHERE status = 'pending' ORDER BY created_at LIMIT 500 LOOP
    v_tau := public.rating_trust(r.user_id, r.creator_id, r.event_type, r.id);
    IF v_tau >= public.rating_param('trust_pending') THEN
      PERFORM public._apply_rating_effect(r.id, v_tau); n := n + 1;
    ELSIF r.created_at < now() - interval '14 days' THEN
      UPDATE public.rating_events SET status = 'dropped' WHERE id = r.id;
    END IF;
  END LOOP;
  RETURN n;
END $$;

-- Public read model: DQI gauge + confidence, LIS, tier and cohort percentile (doc 4.5).
CREATE OR REPLACE VIEW public.creator_rating_public WITH (security_invoker = true) AS
SELECT s.creator_id, s.dqi_x AS dqi, s.dqi_sigma AS sigma, s.dqi_w AS n_eff,
       s.lis_total AS lis, s.active_lis, s.tier, s.last_event_at, s.updated_at,
       ROUND((100 * percent_rank() OVER (PARTITION BY date_trunc('year', p.created_at) ORDER BY s.lis_total))::numeric, 0) AS lis_percentile
FROM public.creator_rating_state s JOIN public.profiles p ON p.id = s.creator_id;
GRANT SELECT ON public.creator_rating_public TO anon, authenticated;

-- A failure inside the rating engine must never block a review / fork / publish.
CREATE OR REPLACE FUNCTION public.safe_record_rating_event(p_creator uuid, p_rater uuid, p_type text, p_quality numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.record_rating_event(p_creator, p_rater, p_type, p_quality);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'rating engine skipped event: %', SQLERRM;
END $$;

-- ---------- triggers feeding the engine (server-side only) ----------
CREATE OR REPLACE FUNCTION public.rating_on_teacher_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.safe_record_rating_event(NEW.teacher_id, NEW.student_id, 'rating', NEW.rating * 2.0);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_rating_teacher_review ON public.teacher_reviews;
CREATE TRIGGER trg_rating_teacher_review AFTER INSERT ON public.teacher_reviews
  FOR EACH ROW EXECUTE FUNCTION public.rating_on_teacher_review();

CREATE OR REPLACE FUNCTION public.rating_on_lesson_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_parent_author uuid;
BEGIN
  IF NEW.is_published THEN
    PERFORM public.safe_record_rating_event(NEW.author_id, NEW.author_id, 'content_publish', 0);
  END IF;
  IF NEW.parent_lesson_id IS NOT NULL THEN
    SELECT author_id INTO v_parent_author FROM public.lessons WHERE id = NEW.parent_lesson_id;
    IF v_parent_author IS NOT NULL AND v_parent_author <> NEW.author_id THEN
      -- creator earns fork_received (quality signal 8/10 per fork); forker earns fork_given
      PERFORM public.safe_record_rating_event(v_parent_author, NEW.author_id, 'fork_received', 8);
      PERFORM public.safe_record_rating_event(NEW.author_id, NEW.author_id, 'fork_given', 0);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_rating_lesson_insert ON public.lessons;
CREATE TRIGGER trg_rating_lesson_insert AFTER INSERT ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.rating_on_lesson_insert();

CREATE OR REPLACE FUNCTION public.rating_on_arena_pass() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'passed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'passed') THEN
    PERFORM public.safe_record_rating_event(NEW.user_id, NEW.user_id, 'arena', 0);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_rating_arena_pass ON public.arena_attempts;
CREATE TRIGGER trg_rating_arena_pass AFTER INSERT OR UPDATE OF status ON public.arena_attempts
  FOR EACH ROW EXECUTE FUNCTION public.rating_on_arena_pass();

-- ---------- lock down ----------
REVOKE EXECUTE ON FUNCTION
  public.rating_trust(uuid, uuid, text, uuid), public._apply_rating_effect(uuid, numeric),
  public.record_rating_event(uuid, uuid, text, numeric), public.recheck_pending_rating_events(),
  public.safe_record_rating_event(uuid, uuid, text, numeric),
  public.rating_on_teacher_review(), public.rating_on_lesson_insert(), public.rating_on_arena_pass()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_rating_event(uuid, uuid, text, numeric),
  public.recheck_pending_rating_events() TO service_role;

NOTIFY pgrst, 'reload schema';
