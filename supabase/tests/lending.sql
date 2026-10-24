-- Lending rules. Rolled back; prints "LENDING OK".
begin;
insert into auth.users (id, aud, role, email)
values ('00000000-0000-4000-8000-0000000000a9', 'authenticated', 'authenticated', 'lend@rls.test');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a9","role":"authenticated"}', true);

insert into public.cycles (id, name, start_date, end_date, pocket_cents)
  values ('00000000-0000-4000-8000-0000000000b9', 'Nov', '2026-10-23', '2026-11-22', 100000);
insert into public.cycle_items (id, cycle_id, name, kind, planned_cents)
  values ('00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-0000000000b9', 'Personal', 'envelope', 100000);

do $$
declare loan uuid; spend uuid;
begin
  insert into public.transactions (cycle_id, cycle_item_id, amount_cents, date, kind, counterparty)
    values ('00000000-0000-4000-8000-0000000000b9', '00000000-0000-4000-8000-0000000000c9', 30000, '2026-10-24', 'lend', 'Thabo')
    returning id into loan;
  insert into public.transactions (cycle_id, cycle_item_id, amount_cents, date)
    values ('00000000-0000-4000-8000-0000000000b9', '00000000-0000-4000-8000-0000000000c9', 5000, '2026-10-24')
    returning id into spend;

  -- A loan needs a name.
  begin
    insert into public.transactions (cycle_id, amount_cents, date, kind)
      values ('00000000-0000-4000-8000-0000000000b9', 100, '2026-10-24', 'lend');
    raise exception 'a loan without a name was allowed';
  exception when check_violation then null;
  end;

  -- Money back can point at a loan, but not at a plain spend.
  insert into public.transactions (cycle_id, cycle_item_id, amount_cents, date, kind, counterparty, repays_id)
    values ('00000000-0000-4000-8000-0000000000b9', '00000000-0000-4000-8000-0000000000c9', 30000, '2026-10-25', 'refund', 'Thabo', loan);
  begin
    insert into public.transactions (cycle_id, amount_cents, date, kind, repays_id)
      values ('00000000-0000-4000-8000-0000000000b9', 100, '2026-10-25', 'refund', spend);
    raise exception 'a repayment of a spend was allowed';
  exception when check_violation then null;
  end;
  -- Only money back may repay anything.
  begin
    insert into public.transactions (cycle_id, amount_cents, date, kind, counterparty, repays_id)
      values ('00000000-0000-4000-8000-0000000000b9', 100, '2026-10-25', 'lend', 'X', loan);
    raise exception 'a loan repaying a loan was allowed';
  exception when check_violation then null;
  end;

  -- Deleting the loan keeps the money-back row, just unlinked.
  delete from public.transactions where id = loan;
  if (select count(*) from public.transactions where kind = 'refund' and repays_id is null) <> 1 then
    raise exception 'deleting a loan lost its repayment';
  end if;
end $$;

reset role;
select 'LENDING OK' as result;
rollback;
