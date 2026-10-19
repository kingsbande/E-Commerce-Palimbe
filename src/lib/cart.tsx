import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";

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

const STORAGE_KEY = "palimbe_cart_v1";

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
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setItems(JSON.parse(raw) as CartItem[]);
          } catch {
            // ignore a corrupted cart
          }
        }
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items, ready]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => {
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
