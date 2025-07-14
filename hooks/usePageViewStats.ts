import { useState, useEffect, useCallback } from 'react';
import { getAllPageViews, deletePageView } from '../lib/storage-manager';
import type { PageView } from '../lib/types';

export function usePageViewStats() {
  const [stats, setStats] = useState<PageView[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const pageViews = await getAllPageViews();
      // 按总时长降序排序
      const sortedViews = pageViews.sort((a, b) => b.totalDuration - a.totalDuration);
      setStats(sortedViews);
    } catch (error) {
      console.error("Failed to load page view stats:", error);
      setStats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();

    // 监听存储变化，自动刷新
    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes['page-views']) {
        loadStats();
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      chrome.storage.onChanged.removeListener(storageListener);
    };

  }, [loadStats]);

  const handleDelete = useCallback(async (url: string) => {
    try {
      await deletePageView(url);
      // Optimistic update
      setStats(prevStats => prevStats.filter(stat => stat.url !== url));
    } catch (error) {
      console.error("Failed to delete page view:", error);
      // 如果失败，重新加载以恢复状态
      loadStats();
    }
  }, [loadStats]);


  return { stats, loading, reload: loadStats, handleDelete };
}