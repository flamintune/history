import { useState, useEffect } from "react";
import { loadData, STORAGE_KEYS } from "@/lib/storage-manager";
import type { HistoryStats } from "@/lib/types";

export function useWeekStats() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<HistoryStats | null>(null);

  const loadInitialData = async () => {
    setIsLoading(true);
    const storedStats = await loadData<HistoryStats | null>(
      STORAGE_KEYS.weekStats,
      null
    );
    setStats(storedStats);
    setIsLoading(false);
  };

  useEffect(() => {
    loadInitialData();

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "local" && changes[STORAGE_KEYS.weekStats]) {
        setStats(changes[STORAGE_KEYS.weekStats].newValue as HistoryStats);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  return {
    isLoading,
    stats,
    refresh: loadInitialData, // 保持 refresh 函数，以便手动刷新
  };
}