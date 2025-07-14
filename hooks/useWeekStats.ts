import { useState, useEffect } from "react";
import { getWeekStats } from "@/lib/history-analyzer";
import type { HistoryStats } from "@/lib/types";

export function useWeekStats() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<HistoryStats | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const weekStats = await getWeekStats();
      setStats(weekStats);
    } catch (error) {
      console.error("Error loading week stats:", error);
      setStats(null);
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