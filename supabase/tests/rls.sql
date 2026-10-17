-- Proves that nobody but the owner can read or change a row.
--
-- Run it in the Supabase SQL editor (or psql) against a database with the
-- migrations applied. Everything happens inside a transaction that is
-- rolled back, so it leaves no trace. It prints "RLS OK" or stops with an
-- error naming the table that leaked.

begin;

-- Two throwaway users.
insert into auth.users (id, aud, role, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'owner@rls.test'),
  ('00000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'intruder@rls.test');

-- As the owner: one row in every table.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

insert into public.settings default values;
insert into public.recurring_items (id, name, kind, amount_cents, due_day)
  values ('00000000-0000-4000-8000-0000000000a1', 'Rent', 'bill', 650000, 1);
insert into public.cycles (id, name, start_date, end_date, pocket_cents)
  values ('00000000-0000-4000-8000-0000000000a2', 'November 2026', '2026-10-23', '2026-11-22', 974500);
insert into public.cycle_items (id, cycle_id, recurring_item_id, name, kind, planned_cents)
  values ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a2',
          '00000000-0000-4000-8000-0000000000a1', 'Groceries', 'envelope', 136200);
insert into public.transactions (cycle_id, cycle_item_id, amount_cents, date)
  values ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a3', 15000, '2026-10-25');
insert into public.income (amount_cents, date, source) values (500000, '2026-10-20', 'Client invoice');
insert into public.reserves (name, balance_cents) values ('Savings', 200000);
insert into public.todos (text) values ('Claim UIF');

do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array['settings','recurring_items','cycles','cycle_items',
                           'transactions','income','reserves','todos'] loop
    execute format('select count(*) from public.%I', t) into n;
    if n <> 1 then raise exception 'owner should see 1 row in %, saw %', t, n; end if;
  end loop;
end $$;

-- As a second signed-in user: sees nothing, changes nothing.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array['settings','recurring_items','cycles','cycle_items',
                           'transactions','income','reserves','todos'] loop
    execute format('select count(*) from public.%I', t) into n;
    if n <> 0 then raise exception 'other user can see % row(s) in %', n, t; end if;

    execute format('update public.%I set updated_at = now()', t);
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'other user updated % row(s) in %', n, t; end if;

    execute format('delete from public.%I', t);
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'other user deleted % row(s) in %', n, t; end if;
  end loop;

  -- Cannot attach rows to the owner's cycle or plant rows under the owner's id.
  begin
    insert into public.transactions (cycle_id, amount_cents, date)
      values ('00000000-0000-4000-8000-0000000000a2', 100, '2026-10-25');
    raise exception 'other user inserted into the owner''s cycle';
  exception when foreign_key_violation or insufficient_privilege then null;
  end;
  begin
    insert into public.todos (user_id, text)
      values ('00000000-0000-4000-8000-00000000000a', 'planted');
    raise exception 'other user inserted a row owned by the owner';
  exception when insufficient_privilege then null;
  end;
end $$;

-- As anonymous (no session): every table is refused or empty.
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array['settings','recurring_items','cycles','cycle_items',
                           'transactions','income','reserves','todos'] loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      if n <> 0 then raise exception 'anonymous can see % row(s) in %', n, t; end if;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;

reset role;
select 'RLS OK' as result;

rollback;
