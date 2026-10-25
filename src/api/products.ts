import { supabase } from "./client";

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

type ProductSummaryRow = {
  id: string;
  title: string;
  price_mwk: number | string;
  quantity: number;
  unit: string;
  images: string[] | null;
  seller_id: string;
  sellers: SellerBits | SellerBits[] | null;
};

export type ProductDetail = {
  id: string;
  title: string;
  description: string | null;
  price_mwk: number | string;
  quantity: number;
  unit: string;
  images: string[] | null;
  seller_id: string;
  sellers: {
    id: string;
    stall_name: string;
    stall_number: string | null;
    description: string | null;
  } | {
    id: string;
    stall_name: string;
    stall_number: string | null;
    description: string | null;
  }[] | null;
};

export type EditableProduct = {
  id: string;
  title: string;
  description: string | null;
  price_mwk: number | string;
  quantity: number;
  unit: string;
  images: string[] | null;
  category_id: number | null;
  seller_id: string;
};

export type SellerProduct = {
  id: string;
  title: string;
  price_mwk: number;
  quantity: number;
  unit: string;
  is_available: boolean;
  images: string[];
};

export type ProductInput = {
  seller_id: string;
  category_id: number;
  title: string;
  description: string | null;
  price_mwk: number;
  quantity: number;
  unit: string;
  images: string[];
};

export type ProductUpdate = Omit<ProductInput, "seller_id">;

function mapSummary(row: ProductSummaryRow): ProductSummary {
  const seller = Array.isArray(row.sellers) ? row.sellers[0] : row.sellers;
  return {
    id: row.id,
    title: row.title,
    price: Number(row.price_mwk),
    quantity: row.quantity,
    unit: row.unit,
    image: row.images?.[0] ?? null,
    sellerId: row.seller_id,
    stallName: seller?.stall_name ?? "",
    stallNumber: seller?.stall_number ?? null,
  };
}

export async function fetchProducts(options: {
  categoryId?: number | null;
  query?: string;
  from?: number;
  limit?: number;
} = {}): Promise<ProductSummary[]> {
  const limit = options.limit ?? 40;
  let query = supabase
    .from("products")
    .select("id, title, price_mwk, quantity, unit, images, seller_id, sellers(stall_name, stall_number)")
    .gt("quantity", 0)
    .order("created_at", { ascending: false })
    .range(options.from ?? 0, (options.from ?? 0) + limit - 1);

  if (options.categoryId) query = query.eq("category_id", options.categoryId);

  const text = options.query?.replace(/[%_,]/g, " ").trim();
  if (text) query = query.ilike("title", `%${text}%`);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as ProductSummaryRow[]).map(mapSummary);
}

export async function fetchSellerProducts(
  sellerId: string,
  from: number,
  limit: number
): Promise<SellerProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, title, price_mwk, quantity, unit, is_available, images")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);
  if (error) throw error;
  return (data ?? []) as SellerProduct[];
}

export async function fetchProduct(id: string): Promise<ProductDetail | null> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, title, description, price_mwk, quantity, unit, images, seller_id, sellers(id, stall_name, stall_number, description)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ProductDetail | null) ?? null;
}

export async function fetchEditableProduct(id: string): Promise<EditableProduct | null> {
  const { data, error } = await supabase
    .from("products")
    .select("id, title, description, price_mwk, quantity, unit, images, category_id, seller_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as EditableProduct | null) ?? null;
}

export async function createProduct(input: ProductInput): Promise<void> {
  const { error } = await supabase.from("products").insert(input);
  if (error) throw error;
}

export async function updateProduct(id: string, input: ProductUpdate): Promise<boolean> {
  const { data, error } = await supabase
    .from("products")
    .update(input)
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return !!data && data.length > 0;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return !!data && data.length > 0;
}

export async function setProductAvailability(id: string, isAvailable: boolean): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ is_available: isAvailable })
    .eq("id", id);
  if (error) throw error;
}
