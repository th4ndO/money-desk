-- PIN lockout: 5 wrong in a row locks; success resets; anon can't read the
-- table. Rolled back; prints "PIN LOCKOUT OK".
begin;
set local role anon;
do $$
declare left_ integer;
begin
  if public.pin_wait_seconds() <> 0 then raise exception 'should start unlocked'; end if;
  left_ := public.pin_record(false);
  if left_ <> 4 then raise exception 'expected 4 tries left, got %', left_; end if;
  perform public.pin_record(true);
  if public.pin_record(false) <> 4 then raise exception 'success did not reset the count'; end if;
  perform public.pin_record(false); perform public.pin_record(false); perform public.pin_record(false);
  perform public.pin_record(false);
  if public.pin_wait_seconds() < 800 then raise exception '5 failures did not lock for ~15 minutes'; end if;
  begin
    perform * from public.pin_lock;
    raise exception 'anon could read pin_lock';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'PIN LOCKOUT OK' as result;
rollback;
