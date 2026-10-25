import { supabase } from "./client";

export type Category = { id: number; name: string };
export type MarketSection = { id: number; name: string };

let categoriesRequest: Promise<Category[]> | undefined;
let marketSectionsRequest: Promise<MarketSection[]> | undefined;

export function fetchCategories(): Promise<Category[]> {
  if (!categoriesRequest) {
    const request = Promise.resolve(
      supabase
        .from("categories")
        .select("id, name")
        .order("sort_order")
        .then(({ data }) => (data ?? []) as Category[])
    );
    categoriesRequest = request;
    void request.catch(() => {
      if (categoriesRequest === request) categoriesRequest = undefined;
    });
  }
  return categoriesRequest!;
}

export function fetchMarketSections(): Promise<MarketSection[]> {
  if (!marketSectionsRequest) {
    const request = Promise.resolve(
      supabase
        .from("market_sections")
        .select("id, name")
        .order("sort_order")
        .then(({ data }) => (data ?? []) as MarketSection[])
    );
    marketSectionsRequest = request;
    void request.catch(() => {
      if (marketSectionsRequest === request) marketSectionsRequest = undefined;
    });
  }
  return marketSectionsRequest!;
}
