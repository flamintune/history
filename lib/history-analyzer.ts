// 定义分析的数据结构
export interface HistoryStats {
  totalVisits: number;
  uniqueDomains: number;
  topDomains: Array<{ domain: string; visits: number }>;
  hourlyActivity: Record<number, number>; // 小时 -> 访问数量
  dailyActivity: Record<string, number>; // 日期 -> 访问数量
}

// 从URL中提取域名
export function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch (e) {
    return url;
  }
}

// 分析指定时间段的历史记录
export async function analyzeHistory(
  startTime: number,
  endTime: number
): Promise<HistoryStats> {
  // 查询历史记录
  const historyItems = await chrome.history.search({
    text: "", // 空字符串匹配所有记录
    startTime: startTime, // 开始时间
    endTime: endTime, // 结束时间
    maxResults: 5000, // 最大结果数量
  });

  // 初始化统计数据
  const stats: HistoryStats = {
    totalVisits: 0,
    uniqueDomains: 0,
    topDomains: [],
    hourlyActivity: {},
    dailyActivity: {},
  };

  // 域名计数
  const domainCount: Record<string, number> = {};

  // 分析每个历史记录项
  for (const item of historyItems) {
    if (!item.url) continue;

    stats.totalVisits++;

    // 统计域名
    const domain = extractDomain(item.url);
    domainCount[domain] = (domainCount[domain] || 0) + 1;

    // 统计小时活动
    if (item.lastVisitTime) {
      const date = new Date(item.lastVisitTime);
      const hour = date.getHours();
      stats.hourlyActivity[hour] = (stats.hourlyActivity[hour] || 0) + 1;

      // 统计日期活动
      const dateString = date.toISOString().split("T")[0]; // YYYY-MM-DD
      stats.dailyActivity[dateString] =
        (stats.dailyActivity[dateString] || 0) + 1;
    }
  }

  // 计算唯一域名数量
  stats.uniqueDomains = Object.keys(domainCount).length;

  // 计算访问最多的域名
  stats.topDomains = Object.entries(domainCount)
    .map(([domain, visits]) => ({ domain, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10); // 前10名

  return stats;
}

// 获取今天的历史统计
export async function getTodayStats(): Promise<HistoryStats> {
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  return await analyzeHistory(startOfDay, now.getTime());
}

// 获取过去一周的历史统计
export async function getWeekStats(): Promise<HistoryStats> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
  return await analyzeHistory(weekAgo, now.getTime());
}
