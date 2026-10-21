-- Funding a cycle's plan. Allocating to an item raises the item and the
-- pocket (a top-up). When items are already planned but the pocket is
-- short ("Plan exceeds pocket"), the money should raise only the pocket,
-- so allocations can now target a cycle directly.

alter table public.allocations add column cycle_id uuid;
alter table public.allocations
  add foreign key (cycle_id, user_id) references public.cycles (id, user_id) on delete cascade;
alter table public.allocations drop constraint allocations_one_target;
alter table public.allocations
  add constraint allocations_one_target check (num_nonnulls(cycle_item_id, reserve_id, cycle_id) = 1);
create index allocations_cycle_idx on public.allocations (cycle_id);

create or replace function public.allocate(p_date date, p_note text, p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r record;
  v_cycle uuid;
  v_closed timestamptz;
  v_count integer := 0;
  v_available bigint;
  v_total bigint;
begin
  select coalesce(sum((x ->> 'amount_cents')::bigint), 0) into v_total
  from jsonb_array_elements(p_rows) x;

  select coalesce((select sum(amount_cents) from public.income), 0)
       - coalesce((select sum(amount_cents) from public.allocations), 0)
  into v_available;

  if v_total > v_available then
    raise exception 'Only % cents are ready to allocate', v_available using errcode = 'P0001';
  end if;

  for r in
    select * from jsonb_to_recordset(p_rows) as x(cycle_item_id uuid, reserve_id uuid, cycle_id uuid, amount_cents bigint)
  loop
    if r.cycle_item_id is not null then
      select i.cycle_id, c.closed_at into v_cycle, v_closed
      from public.cycle_items i join public.cycles c on c.id = i.cycle_id
      where i.id = r.cycle_item_id;
      if v_cycle is null then raise exception 'Item not found' using errcode = 'P0002'; end if;
      if v_closed is not null then raise exception 'That cycle is closed' using errcode = 'P0003'; end if;
      update public.cycle_items set planned_cents = planned_cents + r.amount_cents where id = r.cycle_item_id;
      update public.cycles set pocket_cents = pocket_cents + r.amount_cents where id = v_cycle;
    elsif r.cycle_id is not null then
      -- Fund the cycle's plan: raise only the pocket.
      select c.closed_at into v_closed from public.cycles c where c.id = r.cycle_id;
      if not found then raise exception 'Cycle not found' using errcode = 'P0002'; end if;
      if v_closed is not null then raise exception 'That cycle is closed' using errcode = 'P0003'; end if;
      update public.cycles set pocket_cents = pocket_cents + r.amount_cents where id = r.cycle_id;
    else
      update public.reserves set balance_cents = balance_cents + r.amount_cents where id = r.reserve_id;
      if not found then raise exception 'Pot not found' using errcode = 'P0002'; end if;
    end if;

    insert into public.allocations (cycle_item_id, reserve_id, cycle_id, amount_cents, date, note)
    values (r.cycle_item_id, r.reserve_id, r.cycle_id, r.amount_cents, p_date, nullif(p_note, ''));
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.unallocate(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  a public.allocations;
  v_cycle uuid;
  v_closed timestamptz;
begin
  select * into a from public.allocations where id = p_id;
  if a.id is null then raise exception 'Allocation not found' using errcode = 'P0002'; end if;

  if a.cycle_item_id is not null then
    select i.cycle_id, c.closed_at into v_cycle, v_closed
    from public.cycle_items i join public.cycles c on c.id = i.cycle_id
    where i.id = a.cycle_item_id;
    if v_closed is not null then raise exception 'That cycle is closed' using errcode = 'P0003'; end if;
    -- The check constraints (>= 0) stop this if the amount was already lowered by hand.
    update public.cycle_items set planned_cents = planned_cents - a.amount_cents where id = a.cycle_item_id;
    update public.cycles set pocket_cents = pocket_cents - a.amount_cents where id = v_cycle;
  elsif a.cycle_id is not null then
    select c.closed_at into v_closed from public.cycles c where c.id = a.cycle_id;
    if v_closed is not null then raise exception 'That cycle is closed' using errcode = 'P0003'; end if;
    update public.cycles set pocket_cents = pocket_cents - a.amount_cents where id = a.cycle_id;
  else
    update public.reserves set balance_cents = balance_cents - a.amount_cents where id = a.reserve_id;
  end if;

  delete from public.allocations where id = p_id;
end;
$$;

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

  insert into public.allocations (id, cycle_item_id, reserve_id, cycle_id, amount_cents, date, note)
  select a.id, a.cycle_item_id, a.reserve_id, a.cycle_id, a.amount_cents, a.date, a.note
  from jsonb_to_recordset(coalesce(p -> 'allocations', '[]'::jsonb)) as a(
    id uuid, cycle_item_id uuid, reserve_id uuid, cycle_id uuid, amount_cents bigint, date date, note text
  );
end;
$$;
