export type SellerOrderStatus =
  | "pending" | "confirmed" | "ready" | "completed" | "declined" | "cancelled";
export type DeliveryType = "delivery" | "pickup";
export type PaymentMethod = "mobile_money" | "cash_on_delivery" | "pay_on_pickup";

export type OrderItem = {
  id: string;
  title: string;
  unit_price_mwk: number | string;
  quantity: number;
  line_total_mwk: number | string;
};

export type StallContact = { whatsapp_phone: string | null };

export type StallBits = {
  stall_name: string;
  stall_number: string | null;
  seller_contacts: StallContact | StallContact[] | null;
};

export type DeliveryAddress = {
  label?: string;
  district?: string;
  area?: string;
  landmark?: string | null;
};

// One stall's part of a buyer's order
export type BuyerSellerOrder = {
  id: string;
  status: SellerOrderStatus;
  subtotal_mwk: number | string;
  sellers: StallBits | StallBits[] | null;
  order_items: OrderItem[];
};

export type BuyerOrder = {
  id: string;
  created_at: string;
  total_mwk: number | string;
  delivery_type: DeliveryType;
  payment_method: PaymentMethod;
  payment_status: string;
  delivery_address: DeliveryAddress | null;
  buyer_phone: string | null;
  notes: string | null;
  seller_orders: BuyerSellerOrder[];
};

export type OrderBits = {
  buyer_name: string;
  buyer_phone: string | null;
  delivery_type: DeliveryType;
  payment_method: PaymentMethod;
  delivery_address: DeliveryAddress | null;
  notes: string | null;
};

// An order as the stall sees it
export type SellerOrderRow = {
  id: string;
  status: SellerOrderStatus;
  subtotal_mwk: number | string;
  created_at: string;
  order_id: string;
  orders: OrderBits | OrderBits[] | null;
  order_items: OrderItem[];
};

export const BUYER_ORDER_SELECT =
  "id, created_at, total_mwk, delivery_type, payment_method, payment_status, delivery_address, buyer_phone, notes, " +
  "seller_orders(id, status, subtotal_mwk, sellers(stall_name, stall_number, seller_contacts(whatsapp_phone)), " +
  "order_items(id, title, unit_price_mwk, quantity, line_total_mwk))";

export const SELLER_ORDER_SELECT =
  "id, status, subtotal_mwk, created_at, order_id, " +
  "orders(buyer_name, buyer_phone, delivery_type, payment_method, delivery_address, notes), " +
  "order_items(id, title, unit_price_mwk, quantity, line_total_mwk)";

// The database can return a single related row as an object or as a one-item list
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const STATUS_LABEL: Record<SellerOrderStatus, string> = {
  pending: "Waiting for the stall",
  confirmed: "Confirmed",
  ready: "Ready",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash_on_delivery: "Cash on delivery",
  pay_on_pickup: "Pay on pickup",
  mobile_money: "Mobile money",
};

export function describeAddress(a: DeliveryAddress | null): string {
  if (!a) return "";
  const place = [a.area, a.district].filter(Boolean).join(", ");
  const parts = [a.label ? `${a.label}: ${place}` : place];
  if (a.landmark) parts.push(`Near ${a.landmark}`);
  return parts.join(" (") + (a.landmark ? ")" : "");
}
