-- Money Desk schema. All money is integer cents (bigint). Due dates and
-- cycle boundaries are `date`; audit columns are `timestamptz`.

create extension if not exists btree_gist with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- settings: one row per user -------------------------------------------------
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  -- 1–28 so that every monthly item lands exactly once in every cycle.
  -- (A start day of 29–31 would clamp to e.g. 28 Feb and give some cycles
  -- zero or two occurrences of the same bill.)
  cycle_start_day smallint not null default 23 check (cycle_start_day between 1 and 28),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  timezone text not null default 'Africa/Johannesburg' check (timezone = 'Africa/Johannesburg'),
  bank_balance_cents bigint,
  bank_balance_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- recurring_items: the template ----------------------------------------------
create table public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  kind text not null check (kind in ('bill', 'envelope', 'saving')),
  amount_cents bigint not null check (amount_cents >= 0),
  due_day smallint check (due_day between 1 and 31),
  frequency text not null default 'monthly' check (frequency in ('monthly', 'once', 'every_n_months')),
  interval_months smallint check (interval_months between 2 and 24),
  -- Also the anchor month for every_n_months and the date of a `once` item.
  starts_on date not null default (now() at time zone 'Africa/Johannesburg')::date,
  ends_on date,
  category text check (char_length(category) <= 50),
  notes text check (char_length(notes) <= 1000),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_interval_matches_frequency
    check ((frequency = 'every_n_months') = (interval_months is not null)),
  constraint recurring_dated_items_have_due_day
    check (kind = 'envelope' or frequency = 'once' or due_day is not null),
  constraint recurring_ends_after_start check (ends_on is null or ends_on >= starts_on)
);
create index recurring_items_user_idx on public.recurring_items (user_id, sort_order);

-- cycles -----------------------------------------------------------------------
-- No stored status: planned / active / ended / closed is derived from the
-- dates, today (Johannesburg) and closed_at, so it can never drift.
create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  start_date date not null,
  end_date date not null,
  pocket_cents bigint not null check (pocket_cents >= 0),
  closed_at timestamptz,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cycles_end_after_start check (end_date >= start_date),
  constraint cycles_user_start_unique unique (user_id, start_date),
  -- Two cycles may never cover the same day, so "the current cycle" is unambiguous.
  constraint cycles_no_overlap exclude using gist (
    user_id with =,
    daterange(start_date, end_date, '[]') with &&
  ),
  constraint cycles_id_user_unique unique (id, user_id)
);

-- cycle_items: per-cycle snapshot ---------------------------------------------
create table public.cycle_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cycle_id uuid not null,
  recurring_item_id uuid references public.recurring_items (id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  kind text not null check (kind in ('bill', 'envelope', 'saving')),
  category text check (char_length(category) <= 50),
  planned_cents bigint not null check (planned_cents >= 0),
  due_date date,
  paid boolean not null default false,
  paid_on date,
  actual_cents bigint check (actual_cents >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (cycle_id, user_id) references public.cycles (id, user_id) on delete cascade,
  constraint cycle_items_envelopes_not_paid check (kind <> 'envelope' or (not paid and actual_cents is null)),
  constraint cycle_items_paid_has_amount check (not paid or actual_cents is not null),
  constraint cycle_items_id_cycle_unique unique (id, cycle_id)
);
create index cycle_items_cycle_idx on public.cycle_items (cycle_id);
create index cycle_items_user_idx on public.cycle_items (user_id);
create index cycle_items_recurring_idx on public.cycle_items (recurring_item_id);

-- transactions: logged spending -----------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cycle_id uuid not null,
  cycle_item_id uuid,
  amount_cents bigint not null check (amount_cents > 0),
  date date not null,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (cycle_id, user_id) references public.cycles (id, user_id) on delete cascade,
  -- The envelope must belong to the same cycle. Deleting it turns the
  -- spend into "unplanned" rather than losing it.
  foreign key (cycle_item_id, cycle_id) references public.cycle_items (id, cycle_id)
    on delete set null (cycle_item_id)
);
create index transactions_cycle_idx on public.transactions (cycle_id, date);
create index transactions_item_idx on public.transactions (cycle_item_id);
create index transactions_user_idx on public.transactions (user_id);

-- income -----------------------------------------------------------------------
create table public.income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  date date not null,
  source text not null check (char_length(source) between 1 and 200),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index income_user_date_idx on public.income (user_id, date desc);

-- reserves ---------------------------------------------------------------------
create table public.reserves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  -- Counted towards runway when true.
  spendable boolean not null default false,
  notes text check (char_length(notes) <= 1000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reserves_user_idx on public.reserves (user_id, sort_order);

-- todos ------------------------------------------------------------------------
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 300),
  done boolean not null default false,
  due_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index todos_user_idx on public.todos (user_id, done, sort_order);

-- updated_at triggers ----------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'settings', 'recurring_items', 'cycles', 'cycle_items',
    'transactions', 'income', 'reserves', 'todos'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;
