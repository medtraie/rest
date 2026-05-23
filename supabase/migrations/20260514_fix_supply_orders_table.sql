create table if not exists public.supply_orders (
    id text primary key,
    user_id uuid references auth.users (id) on delete cascade,
    order_number text,
    reference text,
    date timestamptz default now(),
    driver_id text,
    driver_name text,
    client_id text,
    client_name text,
    truck_id text,
    items jsonb not null default '[]'::jsonb,
    subtotal numeric not null default 0,
    tax numeric not null default 0,
    tax_rate numeric not null default 0,
    tax_amount numeric not null default 0,
    total numeric not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.supply_orders
    add column if not exists user_id uuid references auth.users (id) on delete cascade,
    add column if not exists order_number text,
    add column if not exists reference text,
    add column if not exists date timestamptz default now(),
    add column if not exists driver_id text,
    add column if not exists driver_name text,
    add column if not exists client_id text,
    add column if not exists client_name text,
    add column if not exists truck_id text,
    add column if not exists items jsonb not null default '[]'::jsonb,
    add column if not exists subtotal numeric not null default 0,
    add column if not exists tax numeric not null default 0,
    add column if not exists tax_rate numeric not null default 0,
    add column if not exists tax_amount numeric not null default 0,
    add column if not exists total numeric not null default 0,
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists updated_at timestamptz not null default now();

alter table public.supply_orders
    alter column user_id set default auth.uid(),
    alter column items set default '[]'::jsonb,
    alter column subtotal set default 0,
    alter column tax set default 0,
    alter column tax_rate set default 0,
    alter column tax_amount set default 0,
    alter column total set default 0,
    alter column created_at set default now(),
    alter column updated_at set default now();

create index if not exists supply_orders_user_id_idx
    on public.supply_orders (user_id);

create index if not exists supply_orders_date_idx
    on public.supply_orders (date desc);

alter table public.supply_orders enable row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'supply_orders'
          and policyname = 'supply_orders_select_own'
    ) then
        create policy "supply_orders_select_own"
            on public.supply_orders
            for select
            using (auth.uid() = user_id or user_id is null);
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'supply_orders'
          and policyname = 'supply_orders_insert_own'
    ) then
        create policy "supply_orders_insert_own"
            on public.supply_orders
            for insert
            with check (auth.uid() = user_id or user_id is null);
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'supply_orders'
          and policyname = 'supply_orders_update_own'
    ) then
        create policy "supply_orders_update_own"
            on public.supply_orders
            for update
            using (auth.uid() = user_id or user_id is null)
            with check (auth.uid() = user_id or user_id is null);
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'supply_orders'
          and policyname = 'supply_orders_delete_own'
    ) then
        create policy "supply_orders_delete_own"
            on public.supply_orders
            for delete
            using (auth.uid() = user_id or user_id is null);
    end if;
end
$$;
