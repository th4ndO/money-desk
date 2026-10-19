# Status

## Live

- Site: https://thendo-money-desk.vercel.app (Vercel project `money-desk`, Hobby plan,
  deploys automatically from `main`). This project was previously `house-sookoo-data-tracker`.
- Database: Supabase project `money-desk` (`whvmbftpbrqkygnltvvz`, eu-west-2), reused from the
  empty `network-growth` project. All migrations in `supabase/migrations` applied; RLS test passes.
- Sign-in: PIN (4–8 digits). The Supabase password is HMAC(PIN_PEPPER, PIN), so the PIN can't be
  guessed against Supabase directly; the form allows 5 wrong tries per 15 minutes and 20 per day
  (`pin_lock`). Fallback: email link/code. Public sign-ups off; one user (ALLOWED_EMAIL).
  Site URL and redirect allow-list: the Vercel URL and `http://localhost:3000`.
- Vercel env (Production, Preview, Development): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ALLOWED_EMAIL`, `PIN_PEPPER` (sensitive). No service-role key anywhere.

## Verified in production

- Signed-out requests to every page and to `/export/json` redirect to `/login`.
- A forged session cookie is rejected.
- The anon key alone gets HTTP 401 from every table (`npm run check:anon`).
- `robots.txt` disallows everything; pages send `noindex` (meta and `X-Robots-Tag`).

## Notes

- Supabase's built-in email sender allows only a few sign-in emails per hour. If you hit the
  limit, wait an hour or add your own SMTP in Supabase → Authentication → Emails.
- Applying a future migration: paste the new file into Supabase → SQL editor, or ask Claude.
