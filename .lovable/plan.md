## What I'm building

A full tutoring layer on top of Leatha's existing lessons/arena data. Everything in the two reference dashboards becomes real and functional. Existing data (lessons, arena, follows, messages, profiles, points) stays untouched.

## Database (1 migration)

New tables — all with RLS:

- `teacher_profiles` — `user_id`, `subjects[]`, `hourly_rate`, `bio_long`, `years_experience`, `rating_avg`, `rating_count`, `students_count`, `total_earnings`
- `teacher_availability` — `teacher_id`, `weekday` (0-6), `start_time`, `end_time`
- `appointments` — `teacher_id`, `student_id`, `subject`, `starts_at`, `ends_at`, `status` (pending/confirmed/completed/cancelled), `price_cents`, `notes`
- `teacher_reviews` — `teacher_id`, `student_id`, `appointment_id`, `rating` (1-10), `comment`
- `documents` — `owner_id`, `title`, `file_url`, `file_type` (pdf/docx/etc), `file_size_bytes`, `subject`, `visibility` (private/students/public)
- `notifications_read` — track which notifications a user has dismissed (for the bell badge)

New storage bucket: `documents` (private, RLS-gated).

Triggers: recompute `teacher_profiles.rating_avg`/`rating_count` on review insert/update/delete; recompute `students_count` on completed appointments.

## Routes (redesigned + new)

**Redesigned to match images:**

- `/student` — 4 stat cards (My Appointments, Completed Sessions, Teachers Hired, Total Spent), Upcoming Appointments list, Quick Actions grid (Find Teachers, Book Appointment, Upload Document, Messages), Recent Documents, Top Teachers
- `/teacher` — 4 stat cards (Today's Sessions, Total Students, Total Earnings, Average Rating), Upcoming Appointments, Quick Actions (Upload Document, Add Availability, Manage Sessions, Messages), Recent Documents, Recent Reviews

**New routes:**

- `/find-teachers` — searchable/filterable list of verified teachers with subject + rate + rating, "Hire / Book" button
- `/appointments` — list view + book modal (pick teacher → pick available slot → confirm)
- `/appointments/$id` — detail, cancel, mark complete, leave review (student) / accept-decline (teacher)
- `/documents` — list, upload (drag/drop), download, delete; visibility toggle
- `/teacher/earnings` — earnings chart, breakdown by month, per-student totals
- `/teacher/availability` — weekly grid editor
- `/teacher/students` — list of students who booked, with quick-message
- `/teacher/reviews` — full review list
- Visual style

Match the reference: white cards on subtle gray bg, soft pastel icon tiles (blue/green/purple/amber), large stat numbers, clean dividers, rounded `rounded-2xl`, generous padding. Uses existing shadcn primitives + design tokens — no hardcoded colors.

## Out of scope (ask separately)

- **Payments** — `Total Spent` and `Total Earnings` will display from the `price_cents` field on appointments, but actual money processing (Stripe/Paddle) is not wired. add   mobile money support{mtn,airtel,pax tel}When you're ready to take real payments, I'll run the payments setup separately.
- Notifications bell with real push — the badge count works against existing notifications; realtime fan-out already exists.
- first make the pages we have recently worked on like the arena and all after it non visible to the user

## Scope warning

This is a large build — ~1 migration + ~10 new/redesigned route files + new components. I'll do it in one pass, but expect several edits. After approval I'll start with the migration, then routes.