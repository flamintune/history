import { useState, useEffect } from "react";
import { loadStats } from "@/lib/storage-manager";
import type { HistoryStats } from "@/lib/types";

export function useHistoricalStats(date: string | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<HistoryStats | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!date) {
        setStats(null);
        return;
      }

      setIsLoading(true);
      try {
        const historicalStats = await loadStats(date);
        if (historicalStats) {
          setStats({
            ...historicalStats,
            date,
          });
        } else {
          setStats(null);
        }
      } catch (error) {
        console.error(`Error loading stats for date ${date}:`, error);
        setStats(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [date]);

  return {
    isLoading,
    stats,
  };
}