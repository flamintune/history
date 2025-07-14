import { useState, useEffect } from "react";
import { getTodayStats } from "@/lib/history-analyzer";
import type { HistoryStats } from "@/lib/types";

export function useTodayStats() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<HistoryStats | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const todayStats = await getTodayStats();
      setStats(todayStats);
    } catch (error) {
      console.error("Error loading today's stats:", error);
      setStats(null); // 在出错时设置为空
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return {
    isLoading,
    stats,
    refresh: loadData,
  };
}