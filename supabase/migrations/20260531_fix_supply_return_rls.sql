alter table public.supply_orders enable row level security;
alter table public.return_orders enable row level security;

drop policy if exists "supply_orders_select_own" on public.supply_orders;
drop policy if exists "supply_orders_insert_own" on public.supply_orders;
drop policy if exists "supply_orders_update_own" on public.supply_orders;
drop policy if exists "supply_orders_delete_own" on public.supply_orders;

create policy "supply_orders_select_own"
    on public.supply_orders
    for select
    using (auth.uid() = user_id or user_id is null);

create policy "supply_orders_insert_own"
    on public.supply_orders
    for insert
    with check (auth.uid() = user_id or user_id is null);

create policy "supply_orders_update_own"
    on public.supply_orders
    for update
    using (auth.uid() = user_id or user_id is null)
    with check (auth.uid() = user_id or user_id is null);

create policy "supply_orders_delete_own"
    on public.supply_orders
    for delete
    using (auth.uid() = user_id or user_id is null);

drop policy if exists "return_orders_select_own" on public.return_orders;
drop policy if exists "return_orders_insert_own" on public.return_orders;
drop policy if exists "return_orders_update_own" on public.return_orders;
drop policy if exists "return_orders_delete_own" on public.return_orders;

create policy "return_orders_select_own"
    on public.return_orders
    for select
    using (auth.uid() = user_id or user_id is null);

create policy "return_orders_insert_own"
    on public.return_orders
    for insert
    with check (auth.uid() = user_id or user_id is null);

create policy "return_orders_update_own"
    on public.return_orders
    for update
    using (auth.uid() = user_id or user_id is null)
    with check (auth.uid() = user_id or user_id is null);

create policy "return_orders_delete_own"
    on public.return_orders
    for delete
    using (auth.uid() = user_id or user_id is null);
