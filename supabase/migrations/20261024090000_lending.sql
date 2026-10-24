-- Lending and money back. An envelope entry is now one of:
--   spend  - money gone for good
--   lend   - money out that someone owes back (counterparty = who)
--   refund - money back into the envelope; repays_id links it to a loan
-- Repayments are not income, so they are never counted twice.

alter table public.transactions
  add column kind text not null default 'spend' check (kind in ('spend', 'lend', 'refund')),
  add column counterparty text check (char_length(counterparty) between 1 and 100),
  add column repays_id uuid;

alter table public.transactions add constraint transactions_id_user_unique unique (id, user_id);
alter table public.transactions
  add foreign key (repays_id, user_id) references public.transactions (id, user_id) on delete set null (repays_id);
alter table public.transactions
  add constraint transactions_repays_only_refunds check (repays_id is null or kind = 'refund');
alter table public.transactions
  add constraint transactions_lend_has_counterparty check (kind <> 'lend' or counterparty is not null);
create index transactions_repays_idx on public.transactions (repays_id);

-- A repayment may only point at a loan.
create or replace function public.check_repays_a_loan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.repays_id is not null
     and not exists (select 1 from public.transactions where id = new.repays_id and kind = 'lend') then
    raise exception 'A repayment must point at a loan' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger check_repays_a_loan before insert or update of repays_id, kind on public.transactions
  for each row execute function public.check_repays_a_loan();

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

  delete from public.allocations where user_id = v_uid;
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

  -- Spends and loans first, then money back (which may point at a loan).
  insert into public.transactions (id, cycle_id, cycle_item_id, amount_cents, date, note, kind, counterparty)
  select t.id, t.cycle_id, t.cycle_item_id, t.amount_cents, t.date, t.note, coalesce(t.kind, 'spend'), t.counterparty
  from jsonb_to_recordset(coalesce(p -> 'transactions', '[]'::jsonb)) as t(
    id uuid, cycle_id uuid, cycle_item_id uuid, amount_cents bigint, date date, note text,
    kind text, counterparty text, repays_id uuid
  )
  where coalesce(t.kind, 'spend') <> 'refund';

  insert into public.transactions (id, cycle_id, cycle_item_id, amount_cents, date, note, kind, counterparty, repays_id)
  select t.id, t.cycle_id, t.cycle_item_id, t.amount_cents, t.date, t.note, t.kind, t.counterparty, t.repays_id
  from jsonb_to_recordset(coalesce(p -> 'transactions', '[]'::jsonb)) as t(
    id uuid, cycle_id uuid, cycle_item_id uuid, amount_cents bigint, date date, note text,
    kind text, counterparty text, repays_id uuid
  )
  where t.kind = 'refund';

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

  insert into public.allocations (id, cycle_item_id, reserve_id, cycle_id, amount_cents, date, note)
  select a.id, a.cycle_item_id, a.reserve_id, a.cycle_id, a.amount_cents, a.date, a.note
  from jsonb_to_recordset(coalesce(p -> 'allocations', '[]'::jsonb)) as a(
    id uuid, cycle_item_id uuid, reserve_id uuid, cycle_id uuid, amount_cents bigint, date date, note text
  );
end;
$$;
