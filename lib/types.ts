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

export interface PageViewSession {
  startTime: number; // 会话开始时间戳
  endTime: number;   // 会话结束时间戳
}

// 用于聚合单个页面的所有浏览数据
export interface PageView {
  url: string; // 页面 URL
  hostname: string;
  faviconUrl?: string;
  sessions: PageViewSession[]; // 浏览会话列表
  totalDuration: number; // 总浏览时长（秒）
}
