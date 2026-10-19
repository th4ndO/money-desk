-- Allocation rules: money moves exactly, can't exceed what's ready, can't go
-- into a closed cycle, and undo reverses it. Rolled back; prints "ALLOCATIONS OK".
begin;

insert into auth.users (id, aud, role, email)
values ('00000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'alloc@rls.test');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);

insert into public.cycles (id, name, start_date, end_date, pocket_cents)
  values ('00000000-0000-4000-8000-0000000000d1', 'Nov', '2026-10-23', '2026-11-22', 100000);
insert into public.cycle_items (id, cycle_id, name, kind, planned_cents)
  values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1', 'Personal', 'envelope', 100000);
insert into public.reserves (id, name, balance_cents)
  values ('00000000-0000-4000-8000-0000000000f1', 'Savings', 200000);
insert into public.income (amount_cents, date, source) values (100000, '2026-10-25', 'Invoice');

do $$
declare n bigint; p bigint; r bigint; a uuid;
begin
  perform public.allocate('2026-10-25', 'top up', jsonb_build_array(
    jsonb_build_object('cycle_item_id', '00000000-0000-4000-8000-0000000000e1', 'amount_cents', 50000),
    jsonb_build_object('reserve_id', '00000000-0000-4000-8000-0000000000f1', 'amount_cents', 30000)));

  select planned_cents into n from public.cycle_items where id = '00000000-0000-4000-8000-0000000000e1';
  select pocket_cents into p from public.cycles where id = '00000000-0000-4000-8000-0000000000d1';
  select balance_cents into r from public.reserves where id = '00000000-0000-4000-8000-0000000000f1';
  if (n, p, r) <> (150000::bigint, 150000::bigint, 230000::bigint) then
    raise exception 'allocate moved the wrong amounts: item %, pocket %, pot %', n, p, r;
  end if;

  -- R200 is left; asking for R300 must fail and change nothing.
  begin
    perform public.allocate('2026-10-25', null, jsonb_build_array(
      jsonb_build_object('reserve_id', '00000000-0000-4000-8000-0000000000f1', 'amount_cents', 30000)));
    raise exception 'over-allocation was allowed';
  exception when sqlstate 'P0001' then null;
  end;

  -- Closed cycles take no money.
  update public.cycles set closed_at = now() where id = '00000000-0000-4000-8000-0000000000d1';
  begin
    perform public.allocate('2026-10-25', null, jsonb_build_array(
      jsonb_build_object('cycle_item_id', '00000000-0000-4000-8000-0000000000e1', 'amount_cents', 100)));
    raise exception 'allocation into a closed cycle was allowed';
  exception when sqlstate 'P0003' then null;
  end;
  update public.cycles set closed_at = null where id = '00000000-0000-4000-8000-0000000000d1';

  -- Undo reverses exactly.
  select id into a from public.allocations where cycle_item_id is not null;
  perform public.unallocate(a);
  select planned_cents into n from public.cycle_items where id = '00000000-0000-4000-8000-0000000000e1';
  select pocket_cents into p from public.cycles where id = '00000000-0000-4000-8000-0000000000d1';
  if (n, p) <> (100000::bigint, 100000::bigint) then raise exception 'undo left item % pocket %', n, p; end if;
  if (select count(*) from public.allocations) <> 1 then raise exception 'undo did not remove the row'; end if;
end $$;

-- Another user sees no allocations.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.allocations) <> 0 then raise exception 'allocations leak to other users'; end if;
end $$;

reset role;
select 'ALLOCATIONS OK' as result;
rollback;
