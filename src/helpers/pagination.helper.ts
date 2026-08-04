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

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const getPaginationParams = (params: PaginationParams): PaginationResult => {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 10));
  const skip = (page - 1) * limit;

  return { skip, take: limit, page, limit };
};

const buildPaginatedResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> => {
  const pages = Math.ceil(total / limit);

  return {
    data,
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

export { getPaginationParams, buildPaginatedResponse };
export type { PaginationParams, PaginationResult, PaginatedResponse };
