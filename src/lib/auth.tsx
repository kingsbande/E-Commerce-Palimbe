import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import {
  fetchProfile, getSession, onAuthStateChange, signOut as signOutUser,
  startAutoRefresh, stopAutoRefresh,
} from "../api/auth";
import type { Profile } from "../api/auth";

export type { Profile } from "../api/auth";

type AuthContextType = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      setProfile(await fetchProfile(userId));
    } catch (error) {
      setProfile(null);
      console.error("Unable to load user profile", error);
    }
  }, []);

  useEffect(() => {
    getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        // defer: avoid calling Supabase inside the auth callback itself
        setTimeout(() => loadProfile(newSession.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    // Pause token refresh while the app is in the background
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") startAutoRefresh();
      else stopAutoRefresh();
    });

    return () => {
      sub.subscription.unsubscribe();
      appState.remove();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    await signOutUser();
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
