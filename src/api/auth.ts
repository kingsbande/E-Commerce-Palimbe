import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "./client";

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: "buyer" | "seller" | "admin";
  language: "en" | "ny";
};

export function getSession() {
  return supabase.auth.getSession();
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}

export function startAutoRefresh() {
  return supabase.auth.startAutoRefresh();
}

export function stopAutoRefresh() {
  return supabase.auth.stopAutoRefresh();
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, language")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data as Profile | null;
}

export function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function signUpWithPassword(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export function verifyPhoneOtp(phone: string, token: string) {
  return supabase.auth.verifyOtp({ phone, token, type: "sms" });
}

export function resendPhoneOtp(phone: string) {
  return supabase.auth.signInWithOtp({ phone });
}

export async function updateProfileName(userId: string, fullName: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", userId);
  if (error) throw error;
}

export function signOut() {
  return supabase.auth.signOut();
}
