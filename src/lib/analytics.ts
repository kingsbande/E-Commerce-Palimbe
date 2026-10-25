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
