# Status (handover note)

## Done

- **Phase 1**: schema, RLS, sign-in (link or code, ALLOWED_EMAIL only), money/date/cycle logic.
- **Phase 2**: dashboard, cycles, cycle detail, recurring, start cycle, tick bills, log spending, starting data.
- **Phase 3**: income and runway, reserves, to-dos, close/reopen with review, JSON/CSV export, JSON restore.
- 105 unit tests; `scripts/e2e` browser walkthrough passes 48/48 against a local stack.

## Not done: needs the owner

1. Supabase project `money-desk` in the **free** organisation "Personal" (`pwqmqwfkzacmyrxipdai`).
   No charges: do not create it in the Pro organisation.
2. A session whose Supabase connector can reach that organisation.

## Next steps for whoever picks this up (Phase 4)

1. Apply `supabase/migrations/*.sql` in order; run `supabase/tests/rls.sql` (expect `RLS OK`).
2. Auth settings: disable sign-ups, invite the owner's email, Site URL = the Vercel URL, redirect URLs =
   Vercel URL + `http://localhost:3000`. Magic link email template:
   link `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email` plus the code `{{ .Token }}`.
3. Vercel (Hobby, free): import `th4ndo/money-desk`; env vars `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ALLOWED_EMAIL` for Production and Preview.
4. Verify in production: login, incognito sees nothing, `npm run check:anon`, `robots.txt`.
5. Owner signs in, Settings → "Load my starting data".
