# Money Desk

Personal pay-cycle budget: Next.js (App Router) + Supabase + Vercel.
Single user. Amounts are integer cents; dates are Africa/Johannesburg.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the three values
npm run dev                  # http://localhost:3000
```

Checks:

```bash
npm test            # unit tests (money, dates, cycles, seed totals)
npm run typecheck
npm run lint
npm run build
npm run check:anon  # proves the anon key alone reads nothing from any table
```

The database tests live in `supabase/tests/rls.sql`. Paste the file into the
Supabase SQL editor and run it: it prints `RLS OK` and rolls itself back.

## Database

Migrations are in `supabase/migrations`, applied in filename order.

## Sign-in

Email link or 6-digit code, for `ALLOWED_EMAIL` only. Three layers:

1. Supabase Auth has public sign-ups turned off; the one user is invited.
2. `src/proxy.ts` and `/auth/confirm` sign out any session whose email isn't `ALLOWED_EMAIL`.
3. Row Level Security limits every row to `auth.uid() = user_id`; the `anon` role has no table access.

Deploying, backups and starting a new cycle are documented in Phase 4.
