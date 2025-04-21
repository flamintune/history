import { useState, useEffect } from "react";
import { getTodayStats, getWeekStats } from "../lib/history-analyzer";
import { loadStats, getAvailableDates } from "../lib/storage-manager";
import type { HistoryStats } from "../lib/types";

export function useHistoryStats() {
  const [isLoading, setIsLoading] = useState(true);
  const [todayStats, setTodayStats] = useState<HistoryStats | null>(null);
  const [weekStats, setWeekStats] = useState<HistoryStats | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedHistoryStats, setSelectedHistoryStats] =
    useState<HistoryStats | null>(null);

  // 初始加载
  useEffect(() => {
    loadInitialData();
  }, []);

  // 加载初始数据
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // 并行加载各项数据
      const [today, week, dates] = await Promise.all([
        getTodayStats(),
        getWeekStats(),
        getAvailableDates(),
      ]);

      setTodayStats(today);
      setWeekStats(week);
      setAvailableDates(dates);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 加载特定日期的历史统计
  const loadHistoricalStats = async (date: string) => {
    try {
      const stats = await loadStats(date);
      if (stats) {
        // 添加日期信息
        setSelectedHistoryStats({
          ...stats,
          date,
        });
      }
    } catch (error) {
      console.error("Error loading historical stats:", error);
    }
  };

  // 刷新数据
  const refreshData = () => {
    loadInitialData();
  };

  return {
    isLoading,
    todayStats,
    weekStats,
    availableDates,
    selectedHistoryStats,
    loadHistoricalStats,
    refreshData,
  };
}
