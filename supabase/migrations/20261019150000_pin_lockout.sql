-- PIN sign-in lockout. A short PIN is only safe if guesses are limited, so
-- the login form checks and records every attempt here. This is a
-- single-user app, so there is one shared counter.
--
-- The table has RLS on and no policies: nobody can read or write it
-- directly. The two functions below are the only way in.

create table public.pin_lock (
  id smallint primary key default 1 check (id = 1),
  failures integer not null default 0,
  window_start timestamptz not null default now(),
  failures_today integer not null default 0,
  day date not null default (now() at time zone 'Africa/Johannesburg')::date,
  locked_until timestamptz
);
alter table public.pin_lock enable row level security;
revoke all on public.pin_lock from anon, authenticated;
insert into public.pin_lock (id) values (1);

-- Seconds until PIN sign-in is allowed again (0 = allowed now).
create or replace function public.pin_wait_seconds()
returns integer
language sql
security definer
set search_path = ''
as $$
  select greatest(0, ceil(extract(epoch from (locked_until - now()))))::integer
  from public.pin_lock where id = 1;
$$;

-- Record an attempt. 5 failures within 15 minutes locks for 15 minutes;
-- 20 failures in a Johannesburg day locks until the next day.
create or replace function public.pin_record(p_success boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.pin_lock;
  v_today date := (now() at time zone 'Africa/Johannesburg')::date;
begin
  select * into v from public.pin_lock where id = 1 for update;

  if p_success then
    update public.pin_lock set failures = 0, window_start = now(), locked_until = null where id = 1;
    return 0;
  end if;

  if v.window_start < now() - interval '15 minutes' then
    v.failures := 0;
    v.window_start := now();
  end if;
  if v.day <> v_today then
    v.failures_today := 0;
    v.day := v_today;
  end if;
  v.failures := v.failures + 1;
  v.failures_today := v.failures_today + 1;

  if v.failures_today >= 20 then
    v.locked_until := ((v_today + 1)::timestamp at time zone 'Africa/Johannesburg');
  elsif v.failures >= 5 then
    v.locked_until := now() + interval '15 minutes';
    v.failures := 0;
    v.window_start := now();
  end if;

  update public.pin_lock
  set failures = v.failures, window_start = v.window_start, failures_today = v.failures_today,
      day = v.day, locked_until = v.locked_until
  where id = 1;

  return greatest(0, 5 - v.failures);
end;
$$;

revoke all on function public.pin_wait_seconds() from public;
revoke all on function public.pin_record(boolean) from public;
-- The sign-in form runs before there is a session, so anon needs these two.
grant execute on function public.pin_wait_seconds() to anon, authenticated;
grant execute on function public.pin_record(boolean) to anon, authenticated;
