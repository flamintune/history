import { useState, useEffect, useCallback } from 'react';
import { getAllPageViews, deletePageView } from '@/lib/storage-manager';
import { PageView } from '@/lib/types';
import { PageViewAnalyzer } from '@/lib/page-view-analyzer';

interface UsePageViewDetailsOptions {
  startDate?: Date;
  endDate?: Date;
}

export function usePageViewDetails(options: UsePageViewDetailsOptions = {}) {
  const [pageViews, setPageViews] = useState<PageView[]>([]);
  const [allPageViews, setAllPageViews] = useState<PageView[]>([]);
  const [loading, setLoading] = useState(true);
  const { startDate, endDate } = options;
  const analyzer = new PageViewAnalyzer();

  // Load all page views once
  const loadAllPageViews = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedPageViews = await getAllPageViews();
      setAllPageViews(fetchedPageViews);
      
      // Apply initial filtering
      let filteredPageViews = fetchedPageViews;
      if (startDate && endDate) {
        filteredPageViews = analyzer.filterPageViewsByDateRange(
          fetchedPageViews,
          startDate,
          endDate
        );
      }
      
      setPageViews(filteredPageViews);
    } catch (error) {
      console.error("Failed to load page view details:", error);
      setAllPageViews([]);
      setPageViews([]);
    } finally {
      setLoading(false);
    }
  }, [analyzer]);

  // Apply date filtering when dates change
  useEffect(() => {
    if (allPageViews.length > 0) {
      if (startDate && endDate) {
        const filteredPageViews = analyzer.filterPageViewsByDateRange(
          allPageViews,
          startDate,
          endDate
        );
        setPageViews(filteredPageViews);
      } else {
        setPageViews(allPageViews);
      }
    }
  }, [startDate, endDate, allPageViews, analyzer]);

  useEffect(() => {
    loadAllPageViews();

    // Listen for storage changes to refresh data
    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes['page-views']) {
        loadAllPageViews();
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, [loadAllPageViews]);

  const handleDelete = useCallback(async (url: string) => {
    try {
      await deletePageView(url);
      // Optimistic update for both arrays
      setAllPageViews(prevPageViews => prevPageViews.filter(pv => pv.url !== url));
      setPageViews(prevPageViews => prevPageViews.filter(pv => pv.url !== url));
    } catch (error) {
      console.error("Failed to delete page view:", error);
      // If deletion fails, reload to restore state
      loadAllPageViews();
    }
  }, [loadAllPageViews]);

  return {
    pageViews,
    loading,
    reload: loadAllPageViews,
    handleDelete
  };
}