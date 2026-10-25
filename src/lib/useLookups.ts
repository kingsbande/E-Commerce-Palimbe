import { useEffect, useState } from "react";
import { fetchCategories, fetchMarketSections, type Category, type MarketSection } from "../api/lookups";

export type LookupKind = "categories" | "marketSections";

export function useLookups(kind: LookupKind) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [marketSections, setMarketSections] = useState<MarketSection[]>([]);

  useEffect(() => {
    let active = true;
    const request = kind === "categories" ? fetchCategories() : fetchMarketSections();
    request.then((rows) => {
      if (!active) return;
      if (kind === "categories") setCategories(rows as Category[]);
      else setMarketSections(rows as MarketSection[]);
    });
    return () => {
      active = false;
    };
  }, [kind]);

  return { categories, marketSections };
}
