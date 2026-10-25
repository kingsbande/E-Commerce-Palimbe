-- =====================================================================
-- PALIMBE: migration 0002, protect stall contact numbers
-- Run ONCE in Supabase SQL Editor, BEFORE applying the new app files.
-- Save a copy in your repo as: supabase/migrations/0002_seller_contacts.sql
--
-- Why: the stall WhatsApp number used to sit in the public `sellers` table,
-- so anyone could read it through the API. It now lives in `seller_contacts`,
-- which only the stall itself, buyers who have ordered from that stall, and
-- admins can read.
-- =====================================================================

create table public.seller_contacts (
  seller_id       uuid primary key references public.sellers(id) on delete cascade,
  whatsapp_phone  text,
  updated_at      timestamptz not null default now()
);

alter table public.seller_contacts enable row level security;

-- Move existing numbers across
insert into public.seller_contacts (seller_id, whatsapp_phone)
select id, whatsapp_phone
from public.sellers
where whatsapp_phone is not null;

-- Remove the number from the publicly readable table
alter table public.sellers drop column whatsapp_phone;

-- Who can read a stall's contact number
create policy "seller_contacts: stall reads own" on public.seller_contacts
  for select to authenticated
  using (seller_id = public.my_seller_id());

create policy "seller_contacts: buyer reads after ordering" on public.seller_contacts
  for select to authenticated
  using (exists (
    select 1 from public.seller_orders so
    where so.seller_id = seller_contacts.seller_id
      and so.buyer_id = (select auth.uid())
  ));

create policy "seller_contacts: admin reads all" on public.seller_contacts
  for select to authenticated
  using (public.is_admin());

-- Who can write it: only the stall itself
create policy "seller_contacts: stall inserts own" on public.seller_contacts
  for insert to authenticated
  with check (seller_id = public.my_seller_id());

create policy "seller_contacts: stall updates own" on public.seller_contacts
  for update to authenticated
  using (seller_id = public.my_seller_id())
  with check (seller_id = public.my_seller_id());

-- Table privileges (second lock, on top of RLS). Logged-out visitors get nothing.
revoke all on public.seller_contacts from anon, authenticated;
grant select, insert, update on public.seller_contacts to authenticated;
