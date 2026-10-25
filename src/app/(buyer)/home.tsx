import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ProductCard from "../../components/ProductCard";
import Button from "../../components/Button";
import SearchBar from "../../components/SearchBar";
import SectionHeader from "../../components/SectionHeader";
import { brandGradient, colors, radius, shadow } from "../../constants/theme";
import { useAuth } from "../../lib/auth";
import { clearPendingRoute } from "../../lib/pendingRoute";
import { useLookups } from "../../lib/useLookups";
import { fetchProducts, type ProductSummary } from "../../api/products";

const PAGE_SIZE = 20;
const FEED_MAX_AGE_MS = 60_000;

export default function Home() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const { categories } = useLookups("categories");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const nextFrom = useRef(0);
  const loadedCategory = useRef<number | null | undefined>(undefined);
  const lastFetchedAt = useRef(0);
  const requestId = useRef(0);

  const load = useCallback(
    async (isRefresh = false) => {
      const currentRequest = ++requestId.current;
      const categoryChanged = loadedCategory.current !== categoryId;
      if (categoryChanged) {
        setProducts([]);
        setLoading(true);
      }
      if (isRefresh) setRefreshing(true);
      setError("");
      try {
        const rows = await fetchProducts({ categoryId, from: 0, limit: PAGE_SIZE });
        if (currentRequest !== requestId.current) return;
        setProducts(rows);
        nextFrom.current = rows.length;
        setHasMore(rows.length === PAGE_SIZE);
        loadedCategory.current = categoryId;
        lastFetchedAt.current = Date.now();
      } catch (e) {
        if (currentRequest !== requestId.current) return;
        setError(e instanceof Error ? e.message : "Could not load products");
      } finally {
        if (currentRequest === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [categoryId]
  );

  useFocusEffect(
    useCallback(() => {
      if (
        loadedCategory.current !== categoryId ||
        Date.now() - lastFetchedAt.current >= FEED_MAX_AGE_MS
      ) {
        void load();
      }
    }, [categoryId, load])
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const currentRequest = requestId.current;
    setLoadingMore(true);
    try {
      const rows = await fetchProducts({
        categoryId,
        from: nextFrom.current,
        limit: PAGE_SIZE,
      });
      if (currentRequest !== requestId.current) return;
      setProducts((current) => [...current, ...rows]);
      nextFrom.current += rows.length;
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more products");
    } finally {
      setLoadingMore(false);
    }
  }, [categoryId, hasMore, loadingMore]);

  function goToSearch() {
    router.push("/(buyer)/search");
  }

  const chips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {[{ id: null as number | null, name: "All" }, ...categories].map((c) => {
        const active = c.id === categoryId;
        return (
          <Pressable
            key={String(c.id)}
            onPress={() => setCategoryId(c.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const listHeader = (
    <View style={{ gap: 14 }}>
      <Pressable style={styles.banner} onPress={goToSearch}>
        <LinearGradient
          colors={brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerKicker}>LIMBE MARKET</Text>
          <Text style={styles.bannerTitle}>Fresh produce, straight from the stall</Text>
          <View style={styles.bannerCta}>
            <Text style={styles.bannerCtaText}>Start shopping</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </View>
        </View>
        <Ionicons name="basket-outline" size={64} color="rgba(255,255,255,0.35)" />
      </Pressable>

      <View>
        <SectionHeader
          title="Fresh today"
          subtitle={`${products.length} items in stock`}
          actionLabel="Search"
          onAction={goToSearch}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <LinearGradient colors={brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.header}>
          <View style={styles.logoChip}>
            <Image
              source={require("../../../assets/images/icon.png")}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>Palimbe</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {session
                ? `Hello${profile?.full_name ? ", " + profile.full_name : ""}`
                : "Limbe Market, on your phone"}
            </Text>
          </View>
          <Pressable style={styles.headerIcon} hitSlop={8}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
          </Pressable>
          {!session && (
            <Pressable
              style={styles.signIn}
              onPress={() => {
                clearPendingRoute();
                router.push("/(auth)/login");
              }}
            >
              <Text style={styles.signInText}>Sign in</Text>
            </Pressable>
          )}
        </View>
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          <SearchBar onPress={goToSearch} placeholder="Search tomatoes, maize, soap…" />
        </View>
      </LinearGradient>

      <View style={styles.chipBar}>{chips}</View>

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 80 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.column}
          ListHeaderComponent={listHeader}
          renderItem={({ item }) => <ProductCard product={item} />}
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            <View>
              {error && products.length > 0 ? (
                <Text style={styles.emptyText}>{error}</Text>
              ) : null}
              {hasMore ? (
                <View style={{ alignItems: "center", paddingVertical: 12 }}>
                  <Button
                    title="Load more"
                    onPress={() => void loadMore()}
                    loading={loadingMore}
                    disabled={loadingMore}
                  />
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>
                {error || "No products here yet. Check back soon."}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  brand: { fontSize: 24, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  logoChip: {
    backgroundColor: "#fff",
    borderRadius: radius.md,
    padding: 3,
  },
  logo: { width: 36, height: 36, borderRadius: radius.sm },
  sub: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 1 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  signIn: {
    backgroundColor: "#fff",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  signInText: { color: colors.primary, fontWeight: "800", fontSize: 13 },
  chipBar: {
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chipRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 140,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    padding: 16,
    overflow: "hidden",
    ...shadow.card,
  },
  bannerKicker: { fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.85)", letterSpacing: 1 },
  bannerTitle: { fontSize: 18, fontWeight: "800", color: "#fff", marginTop: 4, lineHeight: 23 },
  bannerCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  bannerCtaText: { fontSize: 13, fontWeight: "800", color: colors.primary },
  list: { padding: 12, paddingBottom: 32, gap: 12 },
  column: { gap: 12 },
  empty: { alignItems: "center", gap: 10, paddingTop: 60 },
  emptyText: { textAlign: "center", color: colors.muted, paddingHorizontal: 24 },
});
