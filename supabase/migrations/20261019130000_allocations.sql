-- Allocating income: money that comes in is given a job by adding it to a
-- cycle item (and so to that cycle's pocket) or to a reserve pot.
--
-- Each allocation is a ledger row. The budget figures it changes
-- (cycle_items.planned_cents, cycles.pocket_cents, reserves.balance_cents)
-- are updated in the same transaction, and undoing the allocation reverses
-- exactly that change. "Ready to allocate" is never stored: it is
-- sum(income) - sum(allocations).

alter table public.cycle_items add constraint cycle_items_id_user_unique unique (id, user_id);
alter table public.reserves add constraint reserves_id_user_unique unique (id, user_id);

create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cycle_item_id uuid,
  reserve_id uuid,
  amount_cents bigint not null check (amount_cents > 0),
  date date not null default (now() at time zone 'Africa/Johannesburg')::date,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint allocations_one_target check ((cycle_item_id is null) <> (reserve_id is null)),
  -- Deleting the item or pot deletes its allocation history too; the money
  -- returns to "ready to allocate".
  foreign key (cycle_item_id, user_id) references public.cycle_items (id, user_id) on delete cascade,
  foreign key (reserve_id, user_id) references public.reserves (id, user_id) on delete cascade
);
create index allocations_user_idx on public.allocations (user_id, date desc);
create index allocations_item_idx on public.allocations (cycle_item_id);
create index allocations_reserve_idx on public.allocations (reserve_id);

create trigger set_updated_at before update on public.allocations
  for each row execute function public.set_updated_at();

alter table public.allocations enable row level security;
revoke all on public.allocations from anon;
create policy "own rows: select" on public.allocations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.allocations for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.allocations for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.allocations for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Allocate several amounts at once. p_rows: [{cycle_item_id | reserve_id, amount_cents}]
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
    select * from jsonb_to_recordset(p_rows) as x(cycle_item_id uuid, reserve_id uuid, amount_cents bigint)
  loop
    if r.cycle_item_id is not null then
      select i.cycle_id, c.closed_at into v_cycle, v_closed
      from public.cycle_items i join public.cycles c on c.id = i.cycle_id
      where i.id = r.cycle_item_id;
      if v_cycle is null then raise exception 'Item not found' using errcode = 'P0002'; end if;
      if v_closed is not null then raise exception 'That cycle is closed' using errcode = 'P0003'; end if;
      update public.cycle_items set planned_cents = planned_cents + r.amount_cents where id = r.cycle_item_id;
      update public.cycles set pocket_cents = pocket_cents + r.amount_cents where id = v_cycle;
    else
      update public.reserves set balance_cents = balance_cents + r.amount_cents where id = r.reserve_id;
      if not found then raise exception 'Pot not found' using errcode = 'P0002'; end if;
    end if;

    insert into public.allocations (cycle_item_id, reserve_id, amount_cents, date, note)
    values (r.cycle_item_id, r.reserve_id, r.amount_cents, p_date, nullif(p_note, ''));
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Undo one allocation: take the money back out of where it went.
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
  else
    update public.reserves set balance_cents = balance_cents - a.amount_cents where id = a.reserve_id;
  end if;

  delete from public.allocations where id = p_id;
end;
$$;

revoke all on function public.allocate(date, text, jsonb) from public, anon;
revoke all on function public.unallocate(uuid) from public, anon;
grant execute on function public.allocate(date, text, jsonb) to authenticated;
grant execute on function public.unallocate(uuid) to authenticated;

-- import_all now also restores allocations (ledger rows only: the budget
-- figures in a backup already include them).
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

  insert into public.allocations (id, cycle_item_id, reserve_id, amount_cents, date, note)
  select a.id, a.cycle_item_id, a.reserve_id, a.amount_cents, a.date, a.note
  from jsonb_to_recordset(coalesce(p -> 'allocations', '[]'::jsonb)) as a(
    id uuid, cycle_item_id uuid, reserve_id uuid, amount_cents bigint, date date, note text
  );
end;
$$;
