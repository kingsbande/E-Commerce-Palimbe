import { supabase } from "./client";

export type Address = {
  id: string;
  label: string;
  district: string;
  area: string;
  landmark: string | null;
  is_default: boolean;
};

const ADDRESS_COLUMNS = "id, label, district, area, landmark, is_default";

export async function fetchAddresses(): Promise<Address[]> {
  const { data, error } = await supabase
    .from("addresses")
    .select(ADDRESS_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Address[];
}

export async function createAddress(input: {
  userId: string;
  label: string;
  district: string;
  area: string;
  landmark: string | null;
  isDefault: boolean;
}): Promise<Address> {
  const { data, error } = await supabase
    .from("addresses")
    .insert({
      user_id: input.userId,
      label: input.label,
      district: input.district,
      area: input.area,
      landmark: input.landmark,
      is_default: input.isDefault,
    })
    .select(ADDRESS_COLUMNS)
    .single();
  if (error) throw error;
  return data as Address;
}

export async function placeOrder(input: {
  items: { product_id: string; quantity: number }[];
  paymentMethod: "cash_on_delivery" | "pay_on_pickup";
  deliveryType: "delivery" | "pickup";
  addressId: string | null;
  buyerPhone: string;
  notes: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("place_order", {
    p_items: input.items,
    p_payment_method: input.paymentMethod,
    p_delivery_type: input.deliveryType,
    p_address_id: input.addressId,
    p_buyer_phone: input.buyerPhone,
    p_notes: input.notes,
  });
  if (error) throw error;
  return String(data);
}
