// 额外的类型定义
export interface HistoryStats {
  totalVisits: number;
  uniqueDomains: number;
  topDomains: Array<{ domain: string; visits: number }>;
  hourlyActivity: Record<number, number>;
  dailyActivity: Record<string, number>;
  date?: string;
}

export interface UserSettings {
  collectData: boolean;
  collectionFrequency: "hourly" | "daily";
  excludeIncognito: boolean;
  excludedDomains: string[];
}
