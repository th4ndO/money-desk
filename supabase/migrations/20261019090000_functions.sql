-- All-or-nothing writes that need more than one statement. Both run as the
-- calling user (security invoker), so RLS still applies to every row they
-- touch. The amounts and dates are worked out and validated in TypeScript;
-- these only make the writes atomic.

-- Create a cycle and its item snapshot in one transaction.
create or replace function public.create_cycle(
  p_name text,
  p_start date,
  p_end date,
  p_pocket bigint,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cycle_id uuid;
begin
  insert into public.cycles (name, start_date, end_date, pocket_cents)
  values (p_name, p_start, p_end, p_pocket)
  returning id into v_cycle_id;

  insert into public.cycle_items (
    cycle_id, recurring_item_id, name, kind, category, planned_cents, due_date, sort_order
  )
  select v_cycle_id, i.recurring_item_id, i.name, i.kind, i.category, i.planned_cents, i.due_date, i.sort_order
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as i(
    recurring_item_id uuid, name text, kind text, category text,
    planned_cents bigint, due_date date, sort_order integer
  );

  return v_cycle_id;
end;
$$;

-- Replace all of the caller's data with a backup. Used for restore and
-- for loading the starting data. Any error rolls the whole thing back.
create or replace function public.import_all(p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  delete from public.transactions where user_id = v_uid;
  delete from public.cycle_items where user_id = v_uid;
  delete from public.cycles where user_id = v_uid;
  delete from public.recurring_items where user_id = v_uid;
  delete from public.income where user_id = v_uid;
  delete from public.reserves where user_id = v_uid;
  delete from public.todos where user_id = v_uid;
  delete from public.settings where user_id = v_uid;

  insert into public.settings (cycle_start_day, bank_balance_cents, bank_balance_on)
  select s.cycle_start_day, s.bank_balance_cents, s.bank_balance_on
  from jsonb_to_record(p -> 'settings') as s(
    cycle_start_day smallint, bank_balance_cents bigint, bank_balance_on date
  );

  insert into public.recurring_items (
    id, name, kind, amount_cents, due_day, frequency, interval_months,
    starts_on, ends_on, category, notes, active, sort_order
  )
  select r.id, r.name, r.kind, r.amount_cents, r.due_day, r.frequency, r.interval_months,
         r.starts_on, r.ends_on, r.category, r.notes, r.active, r.sort_order
  from jsonb_to_recordset(coalesce(p -> 'recurring_items', '[]'::jsonb)) as r(
    id uuid, name text, kind text, amount_cents bigint, due_day smallint, frequency text,
    interval_months smallint, starts_on date, ends_on date, category text, notes text,
    active boolean, sort_order integer
  );

  insert into public.cycles (id, name, start_date, end_date, pocket_cents, closed_at, notes)
  select c.id, c.name, c.start_date, c.end_date, c.pocket_cents, c.closed_at, c.notes
  from jsonb_to_recordset(coalesce(p -> 'cycles', '[]'::jsonb)) as c(
    id uuid, name text, start_date date, end_date date, pocket_cents bigint,
    closed_at timestamptz, notes text
  );

  insert into public.cycle_items (
    id, cycle_id, recurring_item_id, name, kind, category, planned_cents,
    due_date, paid, paid_on, actual_cents, sort_order
  )
  select i.id, i.cycle_id, i.recurring_item_id, i.name, i.kind, i.category, i.planned_cents,
         i.due_date, i.paid, i.paid_on, i.actual_cents, i.sort_order
  from jsonb_to_recordset(coalesce(p -> 'cycle_items', '[]'::jsonb)) as i(
    id uuid, cycle_id uuid, recurring_item_id uuid, name text, kind text, category text,
    planned_cents bigint, due_date date, paid boolean, paid_on date, actual_cents bigint,
    sort_order integer
  );

  insert into public.transactions (id, cycle_id, cycle_item_id, amount_cents, date, note)
  select t.id, t.cycle_id, t.cycle_item_id, t.amount_cents, t.date, t.note
  from jsonb_to_recordset(coalesce(p -> 'transactions', '[]'::jsonb)) as t(
    id uuid, cycle_id uuid, cycle_item_id uuid, amount_cents bigint, date date, note text
  );

  insert into public.income (id, amount_cents, date, source, notes)
  select x.id, x.amount_cents, x.date, x.source, x.notes
  from jsonb_to_recordset(coalesce(p -> 'income', '[]'::jsonb)) as x(
    id uuid, amount_cents bigint, date date, source text, notes text
  );

  insert into public.reserves (id, name, balance_cents, spendable, notes, sort_order)
  select x.id, x.name, x.balance_cents, x.spendable, x.notes, x.sort_order
  from jsonb_to_recordset(coalesce(p -> 'reserves', '[]'::jsonb)) as x(
    id uuid, name text, balance_cents bigint, spendable boolean, notes text, sort_order integer
  );

  insert into public.todos (id, text, done, due_date, sort_order)
  select x.id, x.text, x.done, x.due_date, x.sort_order
  from jsonb_to_recordset(coalesce(p -> 'todos', '[]'::jsonb)) as x(
    id uuid, text text, done boolean, due_date date, sort_order integer
  );
end;
$$;

revoke all on function public.create_cycle(text, date, date, bigint, jsonb) from public, anon;
revoke all on function public.import_all(jsonb) from public, anon;
grant execute on function public.create_cycle(text, date, date, bigint, jsonb) to authenticated;
grant execute on function public.import_all(jsonb) to authenticated;
