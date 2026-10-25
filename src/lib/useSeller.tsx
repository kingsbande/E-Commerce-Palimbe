import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";
import { fetchSeller, type Seller } from "../api/sellers";
import { useAuth } from "./auth";

type SellerContextValue = {
  seller: Seller | null;
  loading: boolean;
  reload: () => Promise<void>;
};

const SellerContext = createContext<SellerContextValue>({
  seller: null,
  loading: true,
  reload: async () => {},
});

export function SellerProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id ?? null;
  const requestId = useRef(0);
  const [state, setState] = useState<{
    userId: string | null;
    seller: Seller | null;
    loading: boolean;
  }>({ userId: null, seller: null, loading: true });

  const reload = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!userId) {
      setState({ userId: null, seller: null, loading: false });
      return;
    }

    setState((previous) => ({
      userId,
      seller: previous.userId === userId ? previous.seller : null,
      loading: true,
    }));
    const { seller } = await fetchSeller(userId);
    if (currentRequest !== requestId.current) return;
    setState({ userId, seller, loading: false });
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const hasCurrentUser = state.userId === userId;
  const value = {
    seller: hasCurrentUser ? state.seller : null,
    loading: authLoading || !hasCurrentUser || state.loading,
    reload,
  };

  return <SellerContext.Provider value={value}>{children}</SellerContext.Provider>;
}

export function useSeller() {
  return useContext(SellerContext);
}
