import { useState, useEffect } from 'react';
import { loadData, STORAGE_KEYS } from '@/lib/storage-manager';
import { TimeTrackingStats } from '@/lib/types';

/**
 * Hook to fetch time tracking statistics
 * @returns Object containing time stats and loading state
 */
export function useTimeStats() {
  const [todayStats, setTodayStats] = useState<TimeTrackingStats | null>(null);
  const [weekStats, setWeekStats] = useState<TimeTrackingStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTimeStats = async () => {
      setIsLoading(true);
      try {
        // Load today's time statistics
        const todayTimeStats = await loadData<TimeTrackingStats | null>(
          STORAGE_KEYS.todayTimeStats,
          null
        );
        debugger;
        setTodayStats(todayTimeStats);

        // Load this week's time statistics
        const weekTimeStats = await loadData<TimeTrackingStats | null>(
          STORAGE_KEYS.weekTimeStats,
          null
        );
        setWeekStats(weekTimeStats);
      } catch (error) {
        console.error('Error loading time statistics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimeStats();
  }, []);

  return {
    todayStats,
    weekStats,
    isLoading
  };
}