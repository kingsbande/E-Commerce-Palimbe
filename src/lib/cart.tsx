import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { track } from "./analytics";
import { useAuth } from "./auth";

export type CartItem = {
  productId: string;
  title: string;
  price: number;
  unit: string;
  image: string | null;
  sellerId: string;
  stallName: string;
  maxQty: number;
  quantity: number;
};

type CartContextType = {
  items: CartItem[];
  count: number;
  total: number;
  ready: boolean;
  addItem: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQuantity: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
};

// v2 stores who owns the cart. The old v1 key had no owner, so it is removed.
const STORAGE_KEY = "palimbe_cart_v2";
const OLD_KEY = "palimbe_cart_v1";

type SavedCart = { ownerId: string | null; items: CartItem[] };

const CartContext = createContext<CartContextType>({
  items: [],
  count: 0,
  total: 0,
  ready: false,
  addItem: () => {},
  setQuantity: () => {},
  removeItem: () => {},
  clear: () => {},
});

export const useCart = () => useContext(CartContext);

// NOTE: prices stored here are for display only. The server re-checks every
// price and the stock when the order is placed.
//
// Cart ownership rules:
// - A guest's cart is kept, and becomes the cart of whoever signs in next.
// - A signed-in person's cart is cleared when they sign out, or when a
//   different account signs in on the same phone.
export function CartProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id ?? null;

  const [items, setItems] = useState<CartItem[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.removeItem(OLD_KEY).catch(() => {});
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const saved = JSON.parse(raw) as SavedCart;
          setItems(saved.items ?? []);
          setOwnerId(saved.ownerId ?? null);
        } catch {
          // ignore a corrupted cart
        }
      })
      .finally(() => setReady(true));
  }, []);

  // Keep the cart tied to the right person
  useEffect(() => {
    if (!ready || authLoading) return;
    if (userId) {
      if (ownerId === null) {
        setOwnerId(userId); // a guest cart is adopted by the person who signed in
      } else if (ownerId !== userId) {
        setItems([]); // a different account signed in
        setOwnerId(userId);
      }
    } else if (ownerId !== null) {
      setItems([]); // signed out
      setOwnerId(null);
    }
  }, [ready, authLoading, userId, ownerId]);

  useEffect(() => {
    if (!ready) return;
    const saved: SavedCart = { ownerId, items };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch(() => {});
  }, [items, ownerId, ready]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => {
    track("add_to_cart", { product_id: item.productId });
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        const quantity = Math.min(existing.quantity + qty, item.maxQty);
        return prev.map((i) => (i.productId === item.productId ? { ...i, ...item, quantity } : i));
      }
      return [...prev, { ...item, quantity: Math.min(qty, item.maxQty) }];
    });
  }, []);

  const setQuantity = useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) =>
            i.productId === productId ? { ...i, quantity: Math.min(qty, i.maxQty) } : i
          )
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);
  const total = useMemo(() => items.reduce((n, i) => n + i.price * i.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{ items, count, total, ready, addItem, setQuantity, removeItem, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}
