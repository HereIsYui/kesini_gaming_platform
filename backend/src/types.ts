export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardData {
  counters: {
    userCount: number;
    cardCount: number;
    poolCount: number;
    dropItemCount: number;
    totalDraws: number;
  };
  rarityTotals: Record<string, number>;
  recentHistories: Record<string, unknown>[];
}

export interface FieldConfig {
  key: string;
  label: string;
  type?: "text" | "number" | "boolean" | "textarea" | "select";
  options?: Array<{ label: string; value: string | number | boolean }>;
  readonly?: boolean;
}
