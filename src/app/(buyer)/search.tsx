import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ProductCard from "../../components/ProductCard";
import SearchBar from "../../components/SearchBar";
import { brandGradient, colors, radius } from "../../constants/theme";
import { fetchProducts, type ProductSummary } from "../../api/products";
import { track } from "../../lib/analytics";

const SUGGESTIONS = ["Tomatoes", "Maize", "Onions", "Eggs", "Soap", "Rice"];

export default function Search() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const trackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (trackTimer.current) clearTimeout(trackTimer.current);
    trackTimer.current = null;

    const q = text.trim();
    if (q.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await fetchProducts({ query: q });
        if (!cancelled) {
          setResults(found);
          trackTimer.current = setTimeout(() => {
            trackTimer.current = null;
            track("search", { query: q, results: found.length });
          }, 1500);
        }
      } catch {
        if (!cancelled) setResults([]);
      }
      if (!cancelled) {
        setSearching(false);
        setSearched(true);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (trackTimer.current) clearTimeout(trackTimer.current);
      trackTimer.current = null;
    };
  }, [text]);

  const idle = text.trim().length < 2;
  // Anything shorter than 2 letters shows no results, derived instead of stored.
  const shown = idle ? [] : results;
  const showEmpty = !idle && searched && !searching;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <LinearGradient
        colors={brandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Pressable
          hitSlop={10}
          style={styles.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(buyer)/home"))}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <SearchBar
            value={text}
            onChangeText={setText}
            autoFocus
            placeholder="Search Limbe Market"
          />
        </View>
      </LinearGradient>

      {searching ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <ProductCard product={item} />}
          ListHeaderComponent={
            idle ? (
              <View>
                <Text style={styles.sectionLabel}>Popular searches</Text>
                <View style={styles.suggestRow}>
                  {SUGGESTIONS.map((s) => (
                    <Pressable key={s} style={styles.suggest} onPress={() => setText(s)}>
                      <Ionicons name="trending-up" size={13} color={colors.primary} />
                      <Text style={styles.suggestText}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.hint}>Type at least 2 letters to search.</Text>
              </View>
            ) : searched && shown.length > 0 ? (
              <Text style={styles.count}>
                {shown.length} result{shown.length === 1 ? "" : "s"} for “{text.trim()}”
              </Text>
            ) : null
          }
          ListEmptyComponent={
            showEmpty ? (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={40} color={colors.muted} />
                <Text style={styles.emptyText}>No products found. Try a different word.</Text>
              </View>
            ) : null
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
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  back: { paddingVertical: 2 },
  list: { padding: 12, paddingBottom: 32, gap: 12 },
  column: { gap: 12 },
  sectionLabel: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 10 },
  suggestRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggest: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  suggestText: { fontSize: 13, fontWeight: "600", color: colors.text },
  hint: { fontSize: 13, color: colors.muted, marginTop: 18 },
  count: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  empty: { alignItems: "center", gap: 10, paddingTop: 40 },
  emptyText: { textAlign: "center", color: colors.muted, paddingHorizontal: 24 },
});
