# Palimbe mobile app: analytics tracking

Project root: `C:\Dev\palimbe` (the Expo mobile app, NOT the admin dashboard).

IMPORTANT ORDER: the user runs the SQL file `0005_analytics.sql` in Supabase FIRST. This file only covers the mobile app code.

What this does:
- Records small anonymous events so the admin dashboard can show daily active users and how people use the app: app opened, screen viewed, product viewed, searched, added to cart.
- Each phone gets a random device id (stored on the phone). It is not a phone number, advertising id or hardware id.
- Events are collected in memory and sent in batches (every 15 seconds, when 20 are waiting, or when the app goes to the background). If the phone is offline, they are kept and sent later.
- Orders and sign-ups are NOT tracked here, because the database already records them.
- Nothing is shown on screen, and no existing screen changes behaviour.

Rules for whoever applies this file (a human or an AI agent):
- Create each file in Part A at the exact path shown, with the exact contents.
- Apply the three small edits in Part B exactly as described.
- Do not change the code, rename anything, or add extra files.
- Do not install packages. `expo-constants` and `@react-native-async-storage/async-storage` are already installed.
- Do not touch any file that is not listed here.
- If an anchor line in Part B cannot be found exactly, do NOT guess: stop and report which one is missing.

---

# PART A: new files (2 files)

## File 1: `src/lib/analytics.ts` (new)

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

export type EventName = "app_open" | "screen_view" | "product_view" | "search" | "add_to_cart";

type EventProps = {
  screen?: string;
  product_id?: string;
  query?: string;
  results?: number;
};

type QueuedEvent = EventProps & { name: EventName; at: string };

const DEVICE_KEY = "palimbe_device_id";
const FLUSH_DELAY_MS = 15000;
const BATCH_SIZE = 20;
const MAX_QUEUE = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let deviceId: string | null = null;
let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

// A random id is enough here. It only needs to tell phones apart, not be secret.
function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  const saved = await AsyncStorage.getItem(DEVICE_KEY);
  if (saved && UUID.test(saved)) {
    deviceId = saved;
    return saved;
  }
  const fresh = uuidv4();
  await AsyncStorage.setItem(DEVICE_KEY, fresh);
  deviceId = fresh;
  return fresh;
}

// Records an event. Never throws and never blocks the screen.
export function track(name: EventName, props: EventProps = {}): void {
  const query = props.query?.trim().slice(0, 100);
  queue.push({
    name,
    screen: props.screen?.slice(0, 100),
    product_id: props.product_id && UUID.test(props.product_id) ? props.product_id : undefined,
    query: query || undefined,
    results: props.results,
    at: new Date().toISOString(),
  });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);

  if (queue.length >= BATCH_SIZE) void flush();
  else scheduleFlush();
}

function scheduleFlush(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, FLUSH_DELAY_MS);
}

// Sends waiting events in one request. If the phone is offline they stay queued.
export async function flush(): Promise<void> {
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.splice(0, 50);
  try {
    const id = await getDeviceId();
    const rows = batch.map((e) => ({
      device_id: id,
      created_at: e.at,
      name: e.name,
      screen: e.screen ?? null,
      product_id: e.product_id ?? null,
      query: e.query ?? null,
      results: e.results ?? null,
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version ?? "dev",
    }));
    const { error } = await supabase.from("app_events").insert(rows);
    if (error) {
      // Rejected for good (bad data or no permission): drop it. Otherwise try again later.
      const permanent = /^(22|23|42|PGRST)/.test(String(error.code ?? ""));
      if (!permanent) queue = [...batch, ...queue].slice(0, MAX_QUEUE);
    }
  } catch {
    queue = [...batch, ...queue].slice(0, MAX_QUEUE);
  } finally {
    flushing = false;
  }
  if (queue.length > 0) scheduleFlush();
}
```

---

## File 2: `src/components/Tracker.tsx` (new)

```tsx
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
```

---

# PART B: three small edits in existing files

## Edit 1: `src/app/_layout.tsx`

Add this import with the other imports at the top:

```tsx
import Tracker from "../components/Tracker";
```

Then find this exact line (the last line of the `Gate` function):

```tsx
  return <Stack screenOptions={{ headerShown: false }} />;
```

Replace it with:

```tsx
  return (
    <>
      <Tracker />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
```

## Edit 2: `src/lib/cart.tsx`

Add this import with the other imports at the top:

```tsx
import { track } from "./analytics";
```

Then find this exact line:

```tsx
  const addItem = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => {
```

Replace it with these two lines:

```tsx
  const addItem = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => {
    track("add_to_cart", { product_id: item.productId });
```

## Edit 3: `src/app/(buyer)/search.tsx`

Add this import with the other imports at the top:

```tsx
import { track } from "../../lib/analytics";
```

Then find this exact line:

```tsx
        setResults(await fetchProducts({ query: q }));
```

Replace it with these three lines:

```tsx
        const rows = await fetchProducts({ query: q });
        setResults(rows);
        track("search", { query: q, results: rows.length });
```

---

## Files that already exist and must not be touched (apart from the three edits above)

- `src/lib/supabase.ts`, `src/lib/auth.tsx`, every other screen and component
