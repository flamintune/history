import { PageView, PageViewSession } from './types';
import type { HistoryStats } from "./history-analyzer";

export const STORAGE_KEYS = {
  todayStats: "today-stats",
  weekStats: "week-stats",
  availableDates: "available-dates",
  pageViews: "page-views", // 新增
  dailyStats: (date: string) => `stats-${date}`,
};

export async function saveData<T>(key: string, data: T): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: data });
  } catch (error) {
    console.error(`Error saving data for key "${key}":`, error);
  }
}

export async function loadData<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T) ?? defaultValue;
  } catch (error) {
    console.error(`Error loading data for key "${key}":`, error);
    return defaultValue;
  }
}

// 保存每日统计
export async function saveDailyStats(
  date: string,
  stats: HistoryStats
): Promise<void> {
  await saveData(STORAGE_KEYS.dailyStats(date), stats);

  // 更新统计日期列表
  const dates = await loadData(STORAGE_KEYS.availableDates, [] as string[]);
  if (!dates.includes(date)) {
    dates.push(date);
    await saveData(STORAGE_KEYS.availableDates, dates);
  }
}

// 加载特定日期的统计
export async function loadStats(date: string): Promise<HistoryStats | null> {
  return await loadData(STORAGE_KEYS.dailyStats(date), null);
}

// 获取所有可用的统计日期
export async function getAvailableDates(): Promise<string[]> {
  const dates = await loadData(STORAGE_KEYS.availableDates, [] as string[]);
  return dates.sort().reverse(); // 最新日期在前
}

// 清除所有统计数据
export async function clearAllStats(): Promise<void> {
  const dates = await getAvailableDates();
  const keysToRemove = dates.map(STORAGE_KEYS.dailyStats);
  keysToRemove.push(STORAGE_KEYS.availableDates);
  keysToRemove.push(STORAGE_KEYS.todayStats);
  keysToRemove.push(STORAGE_KEYS.weekStats);

  try {
    await chrome.storage.local.remove(keysToRemove);
    await clearAllPageViews(); // 同时清除页面浏览数据
  } catch (error) {
    console.error("Error clearing all stats:", error);
  }
}

// 规范化 URL，移除查询参数和哈希
function normalizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch (error) {
    // 对于无效 URL，返回原始字符串，尽管这种情况在扩展中较少见
    return urlString;
  }
}

// 获取所有页面浏览数据
export async function getAllPageViews(): Promise<PageView[]> {
  return await loadData(STORAGE_KEYS.pageViews, []);
}

// 保存页面浏览会话
export async function savePageViewSession(
  url: string,
  session: PageViewSession,
  faviconUrl?: string
): Promise<void> {
  const pageViews = await getAllPageViews();
  const normalizedUrl = normalizeUrl(url);
  const urlObject = new URL(url); // 假设 URL 是有效的

  let pageView = pageViews.find((pv) => pv.url === normalizedUrl);

  if (pageView) {
    // 更新会话和总时长
    pageView.sessions.push(session);
    pageView.totalDuration += (session.endTime - session.startTime) / 1000;
  } else {
    // 创建新的 PageView
    pageView = {
      url: normalizedUrl,
      hostname: urlObject.hostname,
      faviconUrl,
      sessions: [session],
      totalDuration: (session.endTime - session.startTime) / 1000,
    };
    pageViews.push(pageView);
  }

  await saveData(STORAGE_KEYS.pageViews, pageViews);
}

// 删除特定页面的浏览数据
export async function deletePageView(url: string): Promise<void> {
  let pageViews = await getAllPageViews();
  const normalizedUrl = normalizeUrl(url);
  pageViews = pageViews.filter((pv) => pv.url !== normalizedUrl);
  await saveData(STORAGE_KEYS.pageViews, pageViews);
}

// 清除所有页面浏览数据
export async function clearAllPageViews(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEYS.pageViews);
  } catch (error) {
    console.error("Error clearing page views:", error);
  }
}
