import {
  BUYER_ORDER_SELECT, SELLER_ORDER_SELECT, type BuyerOrder, type SellerOrderRow, type SellerOrderStatus,
} from "../lib/orders";
import { supabase } from "./client";

export async function fetchBuyerOrders(
  buyerId: string,
  from: number,
  limit: number
): Promise<BuyerOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(BUYER_ORDER_SELECT)
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);
  if (error) throw error;
  return (data as unknown as BuyerOrder[] | null) ?? [];
}

export async function fetchSellerOrders(
  sellerId: string,
  from: number,
  limit: number
): Promise<SellerOrderRow[]> {
  const { data, error } = await supabase
    .from("seller_orders")
    .select(SELLER_ORDER_SELECT)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);
  if (error) throw error;
  return (data as unknown as SellerOrderRow[] | null) ?? [];
}

export async function fetchBuyerOrder(id: string): Promise<BuyerOrder | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(BUYER_ORDER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as BuyerOrder | null) ?? null;
}

export async function fetchSellerOrder(id: string): Promise<SellerOrderRow | null> {
  const { data, error } = await supabase
    .from("seller_orders")
    .select(SELLER_ORDER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as SellerOrderRow | null) ?? null;
}

export async function updateSellerOrderStatus(
  id: string,
  status: SellerOrderStatus
): Promise<boolean> {
  const { data, error } = await supabase
    .from("seller_orders")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return !!data && data.length > 0;
}
