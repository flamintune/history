import type { HistoryStats } from "./history-analyzer";

export const STORAGE_KEYS = {
  todayStats: "today-stats",
  weekStats: "week-stats",
  availableDates: "available-dates",
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
  } catch (error) {
    console.error("Error clearing all stats:", error);
  }
}
