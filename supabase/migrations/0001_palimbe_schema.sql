-- =====================================================================
-- PALIMBE: database schema v1 (Supabase / Postgres)
-- Run ONCE on a fresh `public` schema (right after the reset script).
-- Save a copy in your repo as: supabase/migrations/0001_init.sql
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- New tables must NOT be open to everyone by default.
-- Access is granted explicitly in section 8 and filtered by RLS.
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- =====================================================================
-- 1. ENUMS
-- =====================================================================
create type public.user_role           as enum ('buyer', 'seller', 'admin');
create type public.seller_status       as enum ('pending', 'approved', 'suspended');
create type public.seller_order_status as enum ('pending', 'confirmed', 'ready', 'completed', 'declined', 'cancelled');
create type public.payment_method      as enum ('mobile_money', 'cash_on_delivery', 'pay_on_pickup');
create type public.payment_status      as enum ('pending', 'paid', 'failed', 'refunded');
create type public.delivery_type       as enum ('delivery', 'pickup');

-- =====================================================================
-- 2. TABLES
-- =====================================================================

-- One row per signed-up user (created automatically by a trigger below)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  phone       text,
  role        public.user_role not null default 'buyer',
  language    text not null default 'en' check (language in ('en', 'ny')),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Parts of Limbe Market (used to group stalls)
create table public.market_sections (
  id          smallint generated always as identity primary key,
  name        text not null unique,
  name_ny     text,                      -- Chichewa label (fill in later)
  sort_order  smallint not null default 0
);

-- Product categories
create table public.categories (
  id          smallint generated always as identity primary key,
  name        text not null unique,
  name_ny     text,
  sort_order  smallint not null default 0
);

-- A seller = a stall in the market
create table public.sellers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.profiles(id) on delete cascade,
  stall_name      text not null check (char_length(stall_name) between 2 and 80),
  section_id      smallint references public.market_sections(id),
  stall_number    text,
  description     text,
  photo_url       text,
  whatsapp_phone  text,
  status          public.seller_status not null default 'pending',
  created_at      timestamptz not null default now()
);

create table public.products (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.sellers(id) on delete cascade,
  category_id   smallint references public.categories(id),
  title         text not null check (char_length(title) between 2 and 120),
  description   text,
  price_mwk     numeric(12,2) not null check (price_mwk >= 0),
  quantity      integer not null default 0 check (quantity >= 0),
  unit          text not null default 'piece',   -- e.g. piece, heap, bundle, kg, bag
  images        text[] not null default '{}',
  is_available  boolean not null default true,   -- seller's one-tap in/out of stock switch
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Saved delivery addresses (Malawi: district + area + landmark)
create table public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  label       text not null default 'Home',
  district    text not null,
  area        text not null,
  landmark    text,
  phone       text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- One checkout by one buyer. May contain items from several stalls.
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  buyer_id         uuid not null references public.profiles(id),
  buyer_name       text not null default '',
  buyer_phone      text,
  payment_method   public.payment_method not null,
  payment_status   public.payment_status not null default 'pending',
  delivery_type    public.delivery_type not null,
  delivery_address jsonb,                          -- snapshot of the address at order time
  notes            text,
  total_mwk        numeric(12,2) not null default 0,
  created_at       timestamptz not null default now()
);

-- The part of an order that belongs to ONE stall. Each stall confirms its own part.
create table public.seller_orders (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  seller_id     uuid not null references public.sellers(id),
  buyer_id      uuid not null references public.profiles(id),
  status        public.seller_order_status not null default 'pending',
  subtotal_mwk  numeric(12,2) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (order_id, seller_id)
);

-- Line items. Title and price are copied so history survives later edits.
create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  seller_order_id  uuid not null references public.seller_orders(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,
  title            text not null,
  unit_price_mwk   numeric(12,2) not null,
  quantity         integer not null check (quantity > 0),
  line_total_mwk   numeric(12,2) not null
);

-- Payment attempts (written by Edge Functions / webhooks only)
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  provider           text not null,               -- e.g. paychangu, airtel_money, tnm_mpamba
  provider_reference text,
  amount_mwk         numeric(12,2) not null,
  status             public.payment_status not null default 'pending',
  created_at         timestamptz not null default now()
);

-- =====================================================================
-- 3. INDEXES
-- =====================================================================
create index products_seller_idx      on public.products (seller_id);
create index products_category_idx    on public.products (category_id);
create index products_title_trgm_idx  on public.products using gin (title extensions.gin_trgm_ops);
create index sellers_section_idx      on public.sellers (section_id);
create index addresses_user_idx       on public.addresses (user_id);
create index orders_buyer_idx         on public.orders (buyer_id);
create index seller_orders_seller_idx on public.seller_orders (seller_id);
create index seller_orders_buyer_idx  on public.seller_orders (buyer_id);
create index seller_orders_order_idx  on public.seller_orders (order_id);
create index order_items_so_idx       on public.order_items (seller_order_id);
create index payments_order_idx       on public.payments (order_id);

-- =====================================================================
-- 4. HELPER FUNCTIONS (used by security rules)
-- =====================================================================
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.my_seller_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.sellers where user_id = (select auth.uid());
$$;

create or replace function public.is_approved_seller()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.sellers
    where user_id = (select auth.uid()) and status = 'approved'
  );
$$;

-- =====================================================================
-- 5. TRIGGERS
-- =====================================================================

-- Create a profile whenever someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, phone, full_name, role)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    (case when new.raw_user_meta_data->>'role' = 'seller' then 'seller' else 'buyer' end)::public.user_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Registering a stall upgrades a buyer profile to seller
create or replace function public.mark_profile_as_seller()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set role = 'seller'
  where id = new.user_id and role = 'buyer';
  return new;
end;
$$;

create trigger on_seller_created
  after insert on public.sellers
  for each row execute function public.mark_profile_as_seller();

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger seller_orders_updated_at
  before update on public.seller_orders
  for each row execute function public.set_updated_at();

-- Put stock back when a stall declines or an order is cancelled
create or replace function public.restore_stock_on_cancel()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status in ('declined', 'cancelled')
     and old.status not in ('declined', 'cancelled') then
    update public.products p
       set quantity = p.quantity + oi.quantity
      from public.order_items oi
     where oi.seller_order_id = new.id
       and oi.product_id = p.id;
  end if;
  return new;
end;
$$;

create trigger seller_orders_restore_stock
  after update of status on public.seller_orders
  for each row execute function public.restore_stock_on_cancel();

-- =====================================================================
-- 6. ORDER + ADMIN FUNCTIONS
-- =====================================================================

-- The ONLY way to create an order. Prices and stock are checked on the
-- server, so a modified app can never set its own prices.
--   p_items example: [{"product_id": "<uuid>", "quantity": 2}, ...]
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

-- Admin approves / suspends a stall
create or replace function public.admin_set_seller_status(
  p_seller_id uuid,
  p_status    public.seller_status
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  update public.sellers set status = p_status where id = p_seller_id;
end;
$$;

revoke execute on function public.place_order(jsonb, public.payment_method, public.delivery_type, uuid, text, text) from public, anon;
grant  execute on function public.place_order(jsonb, public.payment_method, public.delivery_type, uuid, text, text) to authenticated;

revoke execute on function public.admin_set_seller_status(uuid, public.seller_status) from public, anon;
grant  execute on function public.admin_set_seller_status(uuid, public.seller_status) to authenticated;

-- =====================================================================
-- 7. ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.market_sections enable row level security;
alter table public.categories      enable row level security;
alter table public.sellers         enable row level security;
alter table public.products        enable row level security;
alter table public.addresses       enable row level security;
alter table public.orders          enable row level security;
alter table public.seller_orders   enable row level security;
alter table public.order_items     enable row level security;
alter table public.payments        enable row level security;

-- profiles
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: admin read all" on public.profiles
  for select to authenticated using (public.is_admin());
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- market sections and categories: public to read
create policy "sections: public read" on public.market_sections
  for select to anon, authenticated using (true);
create policy "categories: public read" on public.categories
  for select to anon, authenticated using (true);

-- sellers
create policy "sellers: public read approved" on public.sellers
  for select to anon, authenticated using (status = 'approved');
create policy "sellers: read own" on public.sellers
  for select to authenticated using (user_id = (select auth.uid()));
create policy "sellers: admin read all" on public.sellers
  for select to authenticated using (public.is_admin());
create policy "sellers: register own stall" on public.sellers
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy "sellers: update own stall" on public.sellers
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- products
create policy "products: public read available" on public.products
  for select to anon, authenticated
  using (
    is_available
    and exists (select 1 from public.sellers s where s.id = seller_id and s.status = 'approved')
  );
create policy "products: seller read own" on public.products
  for select to authenticated using (seller_id = public.my_seller_id());
create policy "products: admin read all" on public.products
  for select to authenticated using (public.is_admin());
create policy "products: approved seller insert" on public.products
  for insert to authenticated
  with check (seller_id = public.my_seller_id() and public.is_approved_seller());
create policy "products: seller update own" on public.products
  for update to authenticated
  using (seller_id = public.my_seller_id())
  with check (seller_id = public.my_seller_id());
create policy "products: seller delete own" on public.products
  for delete to authenticated using (seller_id = public.my_seller_id());

-- addresses (private to the owner)
create policy "addresses: owner all" on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- seller_orders (never references `orders`, to avoid policy recursion)
create policy "seller_orders: buyer read" on public.seller_orders
  for select to authenticated using (buyer_id = (select auth.uid()));
create policy "seller_orders: seller read" on public.seller_orders
  for select to authenticated using (seller_id = public.my_seller_id());
create policy "seller_orders: admin read" on public.seller_orders
  for select to authenticated using (public.is_admin());
create policy "seller_orders: seller update status" on public.seller_orders
  for update to authenticated
  using (seller_id = public.my_seller_id())
  with check (
    seller_id = public.my_seller_id()
    and status in ('confirmed', 'ready', 'completed', 'declined')
  );

-- orders
create policy "orders: buyer read" on public.orders
  for select to authenticated using (buyer_id = (select auth.uid()));
create policy "orders: seller read" on public.orders
  for select to authenticated
  using (exists (select 1 from public.seller_orders so
                 where so.order_id = id and so.seller_id = public.my_seller_id()));
create policy "orders: admin read" on public.orders
  for select to authenticated using (public.is_admin());

-- order_items inherit access from seller_orders
create policy "order_items: read via seller_orders" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.seller_orders so where so.id = seller_order_id));

-- payments (read only; written by Edge Functions with the service role)
create policy "payments: buyer read" on public.payments
  for select to authenticated
  using (exists (select 1 from public.orders o
                 where o.id = order_id and o.buyer_id = (select auth.uid())));
create policy "payments: admin read" on public.payments
  for select to authenticated using (public.is_admin());

-- =====================================================================
-- 8. TABLE PRIVILEGES (second lock, on top of RLS)
-- =====================================================================
revoke all on all tables in schema public from anon, authenticated;

-- Visitors who are not logged in can only browse
grant select on public.market_sections, public.categories,
                public.sellers, public.products to anon;

-- Logged-in users can read (RLS filters rows) ...
grant select on all tables in schema public to authenticated;

-- ... and write only where we deliberately allow it
grant insert, update, delete on public.addresses to authenticated;
grant insert on public.sellers to authenticated;
grant update (stall_name, section_id, stall_number, description, photo_url, whatsapp_phone)
  on public.sellers to authenticated;                       -- NOT status, NOT user_id
grant insert, update, delete on public.products to authenticated;
grant update (full_name, language, avatar_url)
  on public.profiles to authenticated;                      -- NOT role
grant update (status) on public.seller_orders to authenticated;
-- orders, order_items, payments: no client writes. place_order() handles creation.

-- =====================================================================
-- 9. SEED DATA
-- =====================================================================
insert into public.market_sections (name, sort_order) values
  ('Vegetables & Fruits', 1),
  ('Grains & Groceries', 2),
  ('Fish & Meat', 3),
  ('Clothes', 4),
  ('Secondhand Clothes', 5),
  ('Shoes', 6),
  ('Electronics & Phones', 7),
  ('Household & Kitchen', 8),
  ('Beauty & Hair', 9),
  ('Other', 10);

insert into public.categories (name, sort_order) values
  ('Fresh produce', 1),
  ('Grains & flour', 2),
  ('Cooking essentials', 3),
  ('Fish & meat', 4),
  ('Clothes', 5),
  ('Shoes', 6),
  ('Phones & accessories', 7),
  ('Electronics', 8),
  ('Household & kitchen', 9),
  ('Beauty & hair', 10),
  ('Other', 11);

-- =====================================================================
-- 10. STORAGE: product images
-- Folder rule: files must be uploaded to  <user_id>/<filename>
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product-images: public read"        on storage.objects;
drop policy if exists "product-images: seller upload own"  on storage.objects;
drop policy if exists "product-images: seller update own"  on storage.objects;
drop policy if exists "product-images: seller delete own"  on storage.objects;

create policy "product-images: public read" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "product-images: seller upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "product-images: seller update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "product-images: seller delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- =====================================================================
-- AFTER YOU SIGN UP IN THE APP, make yourself the admin (SQL Editor):
--   update public.profiles set role = 'admin' where phone = '265XXXXXXXXX';
-- =====================================================================
