// lib/ratingEngine.ts
// ==================================================
// Leatha Rating & Security Engine v1.0
// Math: Kalman filter for DQI, log-sum for LIS, trust score with decay.
// ==================================================

export interface RatingConfig {
  // DQI (Kalman)
  Q: number;          // process noise per day (0.01 recommended)
  R: number;          // measurement noise variance (2.0 recommended)
  initialX: number;   // initial quality estimate (7.0)
  initialP: number;   // initial uncertainty (25.0)
  // LIS weights (sum not required to be 1, but meaningful ratios)
  lisWeights: Record<string, number>;
  // Trust
  initialTrust: number;
  trustDriftRate: number;   // daily drift toward 70 (0.01)
  velocityWindowMs: number; // 5*60*1000
  velocityThreshold: number; // 30 events per window
  trustMin: number;          // 30 (below this events rejected)
}

export const defaultConfig: RatingConfig = {
  Q: 0.01,
  R: 2.0,
  initialX: 7.0,
  initialP: 25.0,
  lisWeights: {
    forks_received: 0.30,
    rating: 0.20,
    quiz_improvement: 0.15,
    fork_given: 0.10,
    answer: 0.10,
    mentorship: 0.10,
    content_publish: 0.05,
    login: 0.05,
    arena: 0.05,
  },
  initialTrust: 70,
  trustDriftRate: 0.01,
  velocityWindowMs: 5 * 60 * 1000,
  velocityThreshold: 30,
  trustMin: 30,
};

// ---------- Kalman Filter for DQI ----------
export class KalmanFilter {
  public x: number;  // state estimate
  public P: number;  // error covariance
  private lastTime: number;

  constructor(x: number, P: number, lastTime: number = Date.now()) {
    this.x = x;
    this.P = P;
    this.lastTime = lastTime;
  }

  // Call this when a new measurement arrives
  // dtDays: time since last update in days (optional, auto-calculated)
  // trustTau: multiplier (0.1-1.0) that reduces effective R
  update(measurement: number, trustTau: number, config: Pick<RatingConfig, 'Q' | 'R'>, now: number = Date.now()): void {
    const dt = Math.max(0.001, (now - this.lastTime) / (1000 * 3600 * 24));
    // Time update (predict)
    this.P += config.Q * dt;
    // Measurement update
    const effectiveR = config.R / Math.max(0.1, trustTau);
    const K = this.P / (this.P + effectiveR);
    this.x += K * (measurement - this.x);
    this.P *= (1 - K);
    this.lastTime = now;
    // Clamp state to [0,10] for stability
    this.x = Math.min(10, Math.max(0, this.x));
  }

  getConfidence(): number {
    // Confidence = 1 - (2*sqrt(P))/10, capped [0.1, 0.95]
    let conf = 1 - (2 * Math.sqrt(this.P)) / 10;
    return Math.min(0.95, Math.max(0.1, conf));
  }
}

// ---------- LIS Calculator ----------
export class LISCalculator {
  private counts: Map<string, number> = new Map();       // trust-weighted sum
  private activeCounts: Map<string, number> = new Map(); // last 365 days

  // Add a factor event with trustTau weight
  addEvent(factor: string, trustTau: number, isActive: boolean = true): void {
    const old = this.counts.get(factor) || 0;
    this.counts.set(factor, old + trustTau);
    if (isActive) {
      const oldActive = this.activeCounts.get(factor) || 0;
      this.activeCounts.set(factor, oldActive + trustTau);
    }
  }

  // Compute LIS (or active LIS) using given weights
  compute(weights: Record<string, number>, activeOnly: boolean = false): number {
    const source = activeOnly ? this.activeCounts : this.counts;
    let total = 0;
    for (const [factor, sum] of source.entries()) {
      const w = weights[factor] || 0;
      total += w * Math.log10(1 + sum);
    }
    return total;
  }

  // Get raw counts (for persistence)
  getCounts(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }
  getActiveCounts(): Record<string, number> {
    return Object.fromEntries(this.activeCounts);
  }
  setCounts(counts: Record<string, number>, activeCounts: Record<string, number>): void {
    this.counts = new Map(Object.entries(counts));
    this.activeCounts = new Map(Object.entries(activeCounts));
  }
}

// ---------- Trust Manager (with velocity detection) ----------
export class TrustManager {
  private trust: number;
  private lastUpdate: number;
  private eventTimestamps: number[] = []; // for velocity check

  constructor(initialTrust: number = defaultConfig.initialTrust) {
    this.trust = initialTrust;
    this.lastUpdate = Date.now();
  }

  // Update trust based on delta (positive or negative)
  adjust(delta: number): void {
    this.trust = Math.min(100, Math.max(0, this.trust + delta));
    this.lastUpdate = Date.now();
  }

  // Drift trust toward 70 if no negative events
  drift(config: RatingConfig): void {
    const now = Date.now();
    const days = (now - this.lastUpdate) / (1000 * 3600 * 24);
    if (days > 0) {
      const drift = (70 - this.trust) * config.trustDriftRate * days;
      this.trust = Math.min(100, Math.max(0, this.trust + drift));
      this.lastUpdate = now;
    }
  }

  // Check velocity (excessive events in window)
  checkVelocity(config: RatingConfig): boolean {
    const now = Date.now();
    this.eventTimestamps = this.eventTimestamps.filter(ts => now - ts < config.velocityWindowMs);
    this.eventTimestamps.push(now);
    return this.eventTimestamps.length <= config.velocityThreshold;
  }

  getTrustScore(): number {
    return this.trust;
  }

  getTrustTau(): number {
    if (this.trust < defaultConfig.trustMin) return 0;
    return Math.min(1.0, Math.max(0.1, this.trust / 100));
  }

  isAllowed(): boolean {
    return this.trust >= defaultConfig.trustMin;
  }
}

// ---------- Main Rating Engine ----------
export class RatingEngine {
  private kalman: KalmanFilter;
  private lisCalc: LISCalculator;
  private trustMgr: TrustManager;
  private config: RatingConfig;

  constructor(config: RatingConfig = defaultConfig, savedState?: any) {
    this.config = config;
    if (savedState) {
      this.kalman = new KalmanFilter(savedState.kalman.x, savedState.kalman.P, savedState.kalman.lastTime);
      this.lisCalc = new LISCalculator();
      this.lisCalc.setCounts(savedState.lis.counts, savedState.lis.activeCounts);
      this.trustMgr = new TrustManager(savedState.trust.score);
    } else {
      this.kalman = new KalmanFilter(config.initialX, config.initialP);
      this.lisCalc = new LISCalculator();
      this.trustMgr = new TrustManager(config.initialTrust);
    }
  }

  // Process an event (rating, fork, quiz, etc.)
  // Returns { dqi, lis, activeLis, trustTau, allowed }
  processEvent(
    eventType: string,
    qualityValue: number,   // 0-10
    timestamp: number = Date.now(),
    // optional: trust adjustment (if fraud detected upstream)
    trustDelta: number = 0
  ): { allowed: boolean; dqi?: number; lis?: number; activeLis?: number; trustTau?: number } {
    // 1. Trust drift and velocity
    this.trustMgr.drift(this.config);
    const velocityOk = this.trustMgr.checkVelocity(this.config);
    if (!velocityOk) {
      this.trustMgr.adjust(-10);
    }
    // 2. Apply external trust delta
    if (trustDelta !== 0) {
      this.trustMgr.adjust(trustDelta);
    }

    const trustTau = this.trustMgr.getTrustTau();
    if (!this.trustMgr.isAllowed() || trustTau === 0) {
      return { allowed: false };
    }

    // 3. Update DQI (Kalman)
    this.kalman.update(qualityValue, trustTau, this.config, timestamp);

    // 4. Update LIS counts
    const factor = this.eventTypeToFactor(eventType);
    this.lisCalc.addEvent(factor, trustTau, true); // active = true for now (timestamp is recent)
    // For real-world, you'd need to pass isActive flag based on timestamp (e.g., > 365 days old)
    // We assume current event is within last 365 days.

    // 5. Compute LIS values
    const lis = this.lisCalc.compute(this.config.lisWeights, false);
    const activeLis = this.lisCalc.compute(this.config.lisWeights, true);

    return {
      allowed: true,
      dqi: this.kalman.x,
      lis,
      activeLis,
      trustTau,
    };
  }

  // Get current scores without processing event
  getCurrent(): { dqi: number; confidence: number; lis: number; activeLis: number; trustScore: number } {
    return {
      dqi: this.kalman.x,
      confidence: this.kalman.getConfidence(),
      lis: this.lisCalc.compute(this.config.lisWeights, false),
      activeLis: this.lisCalc.compute(this.config.lisWeights, true),
      trustScore: this.trustMgr.getTrustScore(),
    };
  }

  // Export state for persistence
  exportState(): any {
    return {
      kalman: {
        x: this.kalman.x,
        P: this.kalman.P,
        lastTime: this.kalman.lastTime,
      },
      lis: {
        counts: this.lisCalc.getCounts(),
        activeCounts: this.lisCalc.getActiveCounts(),
      },
      trust: {
        score: this.trustMgr.getTrustScore(),
        lastUpdate: this.trustMgr.lastUpdate,
      },
    };
  }

  private eventTypeToFactor(eventType: string): string {
    const map: Record<string, string> = {
      fork_received: 'forks_received',
      rating: 'rating',
      quiz_improvement: 'quiz_improvement',
      fork_given: 'fork_given',
      answer: 'answer',
      mentorship: 'mentorship',
      content_publish: 'content_publish',
      login: 'login',
      arena_challenge: 'arena'
    };
    return map[eventType] || 'forks_received';
  }
}