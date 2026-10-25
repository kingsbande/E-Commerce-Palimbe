import { useGlobalSearchParams, usePathname, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { flush, track } from "../lib/analytics";

// A return after this long away counts as a new visit.
const NEW_VISIT_AFTER_MS = 30 * 60 * 1000;

// Renders nothing. Records app opens, screen views and product views in one place,
// so individual screens do not need tracking code.
export default function Tracker() {
  const pathname = usePathname();
  const segments = useSegments() as string[];
  const params = useGlobalSearchParams<{ id?: string }>();
  const backgroundedAt = useRef<number | null>(null);

  // "(buyer)/home" -> "home", "product/[id]" stays "product/[id]"
  const screen = segments.filter((s) => !s.startsWith("(")).join("/") || "home";
  const productId = screen === "product/[id]" ? String(params.id ?? "") : "";

  useEffect(() => {
    track("app_open");
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        const away = backgroundedAt.current;
        backgroundedAt.current = null;
        if (away && Date.now() - away > NEW_VISIT_AFTER_MS) track("app_open");
      } else {
        if (!backgroundedAt.current) backgroundedAt.current = Date.now();
        void flush();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    track("screen_view", { screen });
  }, [screen, pathname]);

  useEffect(() => {
    if (productId) track("product_view", { product_id: productId });
  }, [productId]);

  return null;
}
