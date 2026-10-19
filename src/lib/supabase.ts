import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// AsyncStorage's web build reads `window`, which does not exist while Expo
// Router server-renders the page — and Supabase touches its storage as soon as
// the client is constructed, which used to crash the dev server outright.
// During that server pass we use a no-op store; the browser rehydrates from
// AsyncStorage once the page takes over.
const memoryStorage: { getItem: (_k: string) => Promise<null>; setItem: (_k: string, _v: string) => Promise<void>; removeItem: (_k: string) => Promise<void> } = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

const storage = typeof window === "undefined" ? memoryStorage : AsyncStorage;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
