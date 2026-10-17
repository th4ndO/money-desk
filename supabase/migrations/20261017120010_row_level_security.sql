-- Every row belongs to one user and only that user can see or change it.
-- The anonymous role gets no table access at all, so a request without a
-- session is refused before RLS is even consulted.

do $$
declare
  t text;
begin
  foreach t in array array[
    'settings', 'recurring_items', 'cycles', 'cycle_items',
    'transactions', 'income', 'reserves', 'todos'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);

    execute format(
      'create policy "own rows: select" on public.%I for select to authenticated
         using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows: insert" on public.%I for insert to authenticated
         with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows: update" on public.%I for update to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows: delete" on public.%I for delete to authenticated
         using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

-- Tables created later in this schema should not silently become readable
-- by anon either.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
