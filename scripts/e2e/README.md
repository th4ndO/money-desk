# Browser walkthrough (local, no cloud)

Runs the real site against a local Postgres with the migrations applied,
PostgREST (the REST layer Supabase uses) and a tiny fake of Supabase Auth
(`gateway.mjs`). `walkthrough.mjs` then drives Chromium at 375px through
sign-in protection, loading the starting data, the dashboard, logging a
spend, starting a cycle, ticking a bill, income and runway, reserves,
to-dos, export/restore and closing a cycle (48 checks).

It needs `playwright` installed next to the scripts and the env vars
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, an anon key signed by
`jwt.mjs`, and `ALLOWED_EMAIL=me@test` when building the app. It is a
developer tool, not part of the deployed site.
