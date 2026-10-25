-- =====================================================================
-- PALIMBE: migration 0003, bug fix + performance
-- Run ONCE in Supabase SQL Editor.
-- Save a copy in your repo as: supabase/migrations/0003_performance_and_fixes.sql
--
-- 1. BUG FIX: stalls could not read the order details (buyer name, phone,
--    address, note) of orders placed with them, because a column in the
--    security rule was not qualified.
-- 2. PERFORMANCE: helper functions in security rules now run once per query
--    instead of once per row.
-- 3. PERFORMANCE: indexes for the shop feed and the order lists.
-- 4. SAFETY: place_order locks products in a fixed order, so two orders that
--    contain the same products can never deadlock each other.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. BUG FIX: "orders: seller read"
--    Before: so.order_id = id   ("id" meant seller_orders.id, never true)
--    After:  so.order_id = orders.id
-- ---------------------------------------------------------------------
alter policy "orders: seller read" on public.orders
  using (
    exists (
      select 1
      from public.seller_orders so
      where so.order_id = orders.id
        and so.seller_id = (select public.my_seller_id())
    )
  );


-- ---------------------------------------------------------------------
-- 2. Evaluate helper functions once per query: wrap them in (select ...)
-- ---------------------------------------------------------------------
alter policy "profiles: admin read all" on public.profiles
  using ((select public.is_admin()));

alter policy "sellers: admin read all" on public.sellers
  using ((select public.is_admin()));

alter policy "products: seller read own" on public.products
  using (seller_id = (select public.my_seller_id()));

alter policy "products: admin read all" on public.products
  using ((select public.is_admin()));

alter policy "products: approved seller insert" on public.products
  with check (
    seller_id = (select public.my_seller_id())
    and (select public.is_approved_seller())
  );

alter policy "products: seller update own" on public.products
  using (seller_id = (select public.my_seller_id()))
  with check (seller_id = (select public.my_seller_id()));

alter policy "products: seller delete own" on public.products
  using (seller_id = (select public.my_seller_id()));

alter policy "seller_orders: seller read" on public.seller_orders
  using (seller_id = (select public.my_seller_id()));

alter policy "seller_orders: admin read" on public.seller_orders
  using ((select public.is_admin()));

alter policy "seller_orders: seller update status" on public.seller_orders
  using (seller_id = (select public.my_seller_id()))
  with check (
    seller_id = (select public.my_seller_id())
    and status in ('confirmed', 'ready', 'completed', 'declined')
  );

alter policy "orders: admin read" on public.orders
  using ((select public.is_admin()));

alter policy "payments: admin read" on public.payments
  using ((select public.is_admin()));

alter policy "seller_contacts: stall reads own" on public.seller_contacts
  using (seller_id = (select public.my_seller_id()));

alter policy "seller_contacts: admin reads all" on public.seller_contacts
  using ((select public.is_admin()));

alter policy "seller_contacts: stall inserts own" on public.seller_contacts
  with check (seller_id = (select public.my_seller_id()));

alter policy "seller_contacts: stall updates own" on public.seller_contacts
  using (seller_id = (select public.my_seller_id()))
  with check (seller_id = (select public.my_seller_id()));


-- ---------------------------------------------------------------------
-- 3. Indexes for the lists the app shows most
-- ---------------------------------------------------------------------

-- Shop feed: newest available products first (all, and per category)
create index if not exists products_feed_idx
  on public.products (created_at desc)
  where is_available and quantity > 0;

create index if not exists products_category_feed_idx
  on public.products (category_id, created_at desc)
  where is_available and quantity > 0;

-- Buyer order history and the stall's order list
create index if not exists orders_buyer_created_idx
  on public.orders (buyer_id, created_at desc);

create index if not exists seller_orders_seller_created_idx
  on public.seller_orders (seller_id, created_at desc);


-- ---------------------------------------------------------------------
-- 4. place_order: same behaviour as before, but products are locked in a
--    fixed order (order by product id) so concurrent orders cannot deadlock.
--    Existing permissions on the function are kept.
-- ---------------------------------------------------------------------
create or replace function public.place_order(
  p_items          jsonb,
  p_payment_method public.payment_method,
  p_delivery_type  public.delivery_type,
  p_address_id     uuid default null,
  p_buyer_phone    text default null,
  p_notes          text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user            uuid := (select auth.uid());
  v_order_id        uuid;
  v_seller_order_id uuid;
  v_item            record;
  v_product         record;
  v_addr            jsonb;
  v_name            text;
  v_phone           text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  if p_delivery_type = 'delivery' then
    select to_jsonb(a) - 'user_id' into v_addr
      from public.addresses a
     where a.id = p_address_id and a.user_id = v_user;
    if v_addr is null then
      raise exception 'A delivery address is required';
    end if;
  end if;

  select full_name, phone into v_name, v_phone
    from public.profiles where id = v_user;

  insert into public.orders
    (buyer_id, buyer_name, buyer_phone, payment_method, delivery_type, delivery_address, notes)
  values
    (v_user, coalesce(v_name, ''), coalesce(p_buyer_phone, v_phone),
     p_payment_method, p_delivery_type, v_addr, p_notes)
  returning id into v_order_id;

  for v_item in
    select (e->>'product_id')::uuid as product_id,
           sum((e->>'quantity')::int)::int as qty
      from jsonb_array_elements(p_items) e
     group by 1
     order by 1                       -- fixed lock order: prevents deadlocks
  loop
    if v_item.qty <= 0 then
      raise exception 'Invalid quantity';
    end if;

    select p.id, p.seller_id, p.title, p.price_mwk, p.quantity,
           p.is_available, s.status as seller_status
      into v_product
      from public.products p
      join public.sellers s on s.id = p.seller_id
     where p.id = v_item.product_id
       for update of p;

    if not found then
      raise exception 'Product not found';
    end if;
    if not v_product.is_available or v_product.seller_status <> 'approved' then
      raise exception '"%" is not available', v_product.title;
    end if;
    if v_product.quantity < v_item.qty then
      raise exception 'Not enough stock for "%"', v_product.title;
    end if;

    insert into public.seller_orders (order_id, seller_id, buyer_id)
    values (v_order_id, v_product.seller_id, v_user)
    on conflict (order_id, seller_id) do update set order_id = excluded.order_id
    returning id into v_seller_order_id;

    insert into public.order_items
      (seller_order_id, product_id, title, unit_price_mwk, quantity, line_total_mwk)
    values
      (v_seller_order_id, v_product.id, v_product.title, v_product.price_mwk,
       v_item.qty, v_product.price_mwk * v_item.qty);

    update public.products
       set quantity = quantity - v_item.qty
     where id = v_product.id;
  end loop;

  update public.seller_orders so
     set subtotal_mwk = (
       select coalesce(sum(oi.line_total_mwk), 0)
         from public.order_items oi
        where oi.seller_order_id = so.id)
   where so.order_id = v_order_id;

  update public.orders
     set total_mwk = (
       select coalesce(sum(subtotal_mwk), 0)
         from public.seller_orders
        where order_id = v_order_id)
   where id = v_order_id;

  return v_order_id;
end;
$$;
