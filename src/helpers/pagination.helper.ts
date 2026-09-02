interface PaginationParams {
  page?: number;
  limit?: number;
}

interface PaginationResult {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

const getPaginationParams = (params: PaginationParams): PaginationResult => {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 10));
  const skip = (page - 1) * limit;

  return { skip, take: limit, page, limit };
};

// Sirf pagination meta return karta hai — data caller apni taraf se add karta hai:
//   return { data: items, ...buildPagination(total, page, limit) };
const buildPagination = (
  total: number,
  page: number,
  limit: number
): { meta: PaginationMeta } => {
  const pages = Math.ceil(total / limit);

  return {
    meta: {
      total,
      page,
      limit,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    },
  };
};

export { getPaginationParams, buildPagination };
export type { PaginationParams, PaginationResult, PaginatedResponse, PaginationMeta };
