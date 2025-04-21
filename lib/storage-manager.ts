import type { HistoryStats } from "./history-analyzer";

// 保存每日统计
export async function saveDailyStats(
  date: string,
  stats: HistoryStats
): Promise<void> {
  await chrome.storage.local.set({ [`stats_${date}`]: stats });

  // 更新统计日期列表
  const { availableDates = [] } = await chrome.storage.local.get(
    "availableDates"
  );
  if (!availableDates.includes(date)) {
    availableDates.push(date);
    await chrome.storage.local.set({ availableDates });
  }
}

// 加载特定日期的统计
export async function loadStats(date: string): Promise<HistoryStats | null> {
  const result = await chrome.storage.local.get(`stats_${date}`);
  return result[`stats_${date}`] || null;
}

// 获取所有可用的统计日期
export async function getAvailableDates(): Promise<string[]> {
  const { availableDates = [] } = await chrome.storage.local.get(
    "availableDates"
  );
  return availableDates.sort().reverse(); // 最新日期在前
}

// 清除所有统计数据
export async function clearAllStats(): Promise<void> {
  const { availableDates = [] } = await chrome.storage.local.get(
    "availableDates"
  );

  // 删除每个日期的统计数据
  for (const date of availableDates) {
    await chrome.storage.local.remove(`stats_${date}`);
  }

  // 清除日期列表
  await chrome.storage.local.remove("availableDates");
}
