import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabase";

export type Seller = {
  id: string;
  stall_name: string;
  stall_number: string | null;
  status: "pending" | "approved" | "suspended";
  section_id: number | null;
};

// Loads the signed-in user's stall, and reloads whenever the screen is focused.
export function useSeller() {
  const { session } = useAuth();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) {
      setSeller(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("sellers")
      .select("id, stall_name, stall_number, status, section_id")
      .eq("user_id", session.user.id)
      .maybeSingle();
    setSeller((data as Seller) ?? null);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return { seller, loading, reload: load };
}
