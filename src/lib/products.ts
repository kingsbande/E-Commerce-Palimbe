import { supabase } from "./supabase";

export type ProductSummary = {
  id: string;
  title: string;
  price: number;
  quantity: number;
  unit: string;
  image: string | null;
  sellerId: string;
  stallName: string;
  stallNumber: string | null;
};

type SellerBits = { stall_name: string; stall_number: string | null };

type Row = {
  id: string;
  title: string;
  price_mwk: number | string;
  quantity: number;
  unit: string;
  images: string[] | null;
  seller_id: string;
  sellers: SellerBits | SellerBits[] | null;
};

function mapRow(r: Row): ProductSummary {
  const seller = Array.isArray(r.sellers) ? r.sellers[0] : r.sellers;
  return {
    id: r.id,
    title: r.title,
    price: Number(r.price_mwk),
    quantity: r.quantity,
    unit: r.unit,
    image: r.images?.[0] ?? null,
    sellerId: r.seller_id,
    stallName: seller?.stall_name ?? "",
    stallNumber: seller?.stall_number ?? null,
  };
}

// Guests and signed-in users both use this. Database rules make sure only
// available products from approved stalls are returned.
export async function fetchProducts(
  opts: { categoryId?: number | null; query?: string; limit?: number } = {}
): Promise<ProductSummary[]> {
  let q = supabase
    .from("products")
    .select("id, title, price_mwk, quantity, unit, images, seller_id, sellers(stall_name, stall_number)")
    .gt("quantity", 0)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 40);

  if (opts.categoryId) q = q.eq("category_id", opts.categoryId);

  const text = opts.query?.replace(/[%_,]/g, " ").trim();
  if (text) q = q.ilike("title", `%${text}%`);

  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(mapRow);
}
