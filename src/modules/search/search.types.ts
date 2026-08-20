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
