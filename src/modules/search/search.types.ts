export interface SearchMeta {
  hasLocation: boolean;
  searchRadiusKm: number | null;
  centerLat: number | null;
  centerLng: number | null;
}

export interface SearchResponse {
  data: Record<string, unknown>[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  searchMeta: SearchMeta;
}

// ============================================================
// Filter Suggestions
// ============================================================
export interface CityFacet {
  city: string;
  count: number;
}

export interface PropertyTypeFacet {
  type: string;
  count: number;
}

export interface BhkFacet {
  bedrooms: number;
  count: number;
}

export interface PriceRangeFacet {
  label: string;
  min: number;
  max: number | null;
  count: number;
}

export interface TrendingSearch {
  query: string;
  score: number;
}

export interface SuggestionsScope {
  city: string | null;
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: number | null;
  transactionType: "SALE" | "RENT";
}

export interface SuggestionsFacets {
  cities: CityFacet[];
  priceRanges: PriceRangeFacet[];
  propertyTypes: PropertyTypeFacet[];
  bhkOptions: BhkFacet[];
  scope: SuggestionsScope;
}

export interface SuggestionsResponse extends SuggestionsFacets {
  trendingSearches: TrendingSearch[];
}
