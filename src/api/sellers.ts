import { supabase } from "./client";

export type Seller = {
  id: string;
  stall_name: string;
  stall_number: string | null;
  status: "pending" | "approved" | "suspended";
  section_id: number | null;
  description: string | null;
  seller_contacts: { whatsapp_phone: string | null } | { whatsapp_phone: string | null }[] | null;
};

export type NewSeller = {
  user_id: string;
  stall_name: string;
  section_id: number;
  stall_number: string | null;
  description: string | null;
};

export type SellerUpdate = Omit<NewSeller, "user_id">;

export async function fetchSeller(userId: string) {
  const { data, error } = await supabase
    .from("sellers")
    .select("id, stall_name, stall_number, status, section_id, description, seller_contacts(whatsapp_phone)")
    .eq("user_id", userId)
    .maybeSingle();
  return { seller: (data as unknown as Seller | null) ?? null, error };
}

export async function createSeller(input: NewSeller) {
  const { data, error } = await supabase
    .from("sellers")
    .insert(input)
    .select("id")
    .single();
  return { data: (data as { id: string } | null) ?? null, error };
}

export async function insertSellerContact(sellerId: string, whatsappPhone: string) {
  return supabase
    .from("seller_contacts")
    .insert({ seller_id: sellerId, whatsapp_phone: whatsappPhone });
}

export async function updateSeller(sellerId: string, input: SellerUpdate) {
  const { data, error } = await supabase
    .from("sellers")
    .update(input)
    .eq("id", sellerId)
    .select("id");
  return { data: (data as { id: string }[] | null) ?? null, error };
}

export async function upsertSellerContact(sellerId: string, whatsappPhone: string | null) {
  return supabase
    .from("seller_contacts")
    .upsert(
      { seller_id: sellerId, whatsapp_phone: whatsappPhone, updated_at: new Date().toISOString() },
      { onConflict: "seller_id" }
    );
}
