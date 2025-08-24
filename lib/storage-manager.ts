import { PageView, PageViewSession, TimeTrackingStats } from './types';
import type { HistoryStats } from "./history-analyzer";
import { 
  maybeCompressData, 
  maybeDecompressData, 
  batchStorageOperations 
} from './compression-utils';

// In-memory cache for frequently accessed data
const memoryCache: Record<string, {
  data: any;
  timestamp: number;
  expiresAt: number;
}> = {};

// Cache expiration time (5 minutes)
const CACHE_EXPIRATION_MS = 5 * 60 * 1000;

// Batch operation queue
let batchQueue: Array<{ key: string; data: any }> = [];
let batchTimeout: number | null = null;

export const STORAGE_KEYS = {
  todayStats: "today-stats",
  weekStats: "week-stats",
  availableDates: "available-dates",
  pageViews: "page-views",
  userSettings: "user-settings",
  dailyStats: (date: string) => `stats-${date}`,
  todayTimeStats: "today-time-stats",
  weekTimeStats: "week-time-stats",
  domainStats: "domain-stats",
  pageViewsByDate: (date: string) => `page-views-${date}`, // New key for date-based page views
};

/**
 * Save data to storage with optional compression for large datasets
 * Uses batching for better performance when multiple writes occur in quick succession
 * 
 * @param key - Storage key
 * @param data - Data to save
 * @param immediate - Whether to save immediately or batch with other operations
 * @returns Promise that resolves when the operation is complete
 */
export async function saveData<T>(key: string, data: T, immediate: boolean = false): Promise<void> {
  try {
    // Update the memory cache
    memoryCache[key] = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_EXPIRATION_MS
    };
    
    if (immediate) {
      // Save immediately
      const { data: processedData, compressed } = maybeCompressData(data);
      await chrome.storage.local.set({ 
        [key]: {
          data: processedData,
          compressed,
          timestamp: Date.now()
        }
      });
    } else {
      // Add to batch queue
      const existingIndex = batchQueue.findIndex(op => op.key === key);
      if (existingIndex >= 0) {
        // Update existing operation
        batchQueue[existingIndex].data = data;
      } else {
        // Add new operation
        batchQueue.push({ key, data });
      }
      
      // Schedule batch processing if not already scheduled
      if (batchTimeout === null) {
        batchTimeout = window.setTimeout(processBatchQueue, 100);
      }
    }
  } catch (error) {
    console.error(`Error saving data for key "${key}":`, error);
  }
}

/**
 * Process the batch queue of storage operations
 */
async function processBatchQueue(): Promise<void> {
  try {
    if (batchQueue.length > 0) {
      const operations = [...batchQueue];
      batchQueue = [];
      await batchStorageOperations(operations);
    }
  } catch (error) {
    console.error('Error processing batch queue:', error);
  } finally {
    batchTimeout = null;
  }
}

/**
 * Load data from storage with decompression support
 * Uses memory cache for frequently accessed data to improve performance
 * 
 * @param key - Storage key
 * @param defaultValue - Default value if key doesn't exist
 * @param bypassCache - Whether to bypass the memory cache
 * @returns Promise resolving to the requested data
 */
export async function loadData<T>(key: string, defaultValue: T, bypassCache: boolean = false): Promise<T> {
  try {
    // Check memory cache first if not bypassing
    if (!bypassCache && memoryCache[key] && memoryCache[key].expiresAt > Date.now()) {
      return memoryCache[key].data as T;
    }
    
    // Load from storage
    const result = await chrome.storage.local.get(key);
    const container = result[key];
    
    // Handle compressed data
    if (container && typeof container === 'object' && 'compressed' in container) {
      const decompressedData = maybeDecompressData(container);
      
      // Update cache
      memoryCache[key] = {
        data: decompressedData,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_EXPIRATION_MS
      };
      
      return decompressedData as T;
    }
    
    // Handle legacy data format (not compressed)
    if (container !== undefined) {
      // Update cache
      memoryCache[key] = {
        data: container,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_EXPIRATION_MS
      };
      
      return container as T;
    }
    
    return defaultValue;
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
    await clearAllPageViews(); // 同时清除页面浏览数据
  } catch (error) {
    console.error("Error clearing all stats:", error);
  }
}

// 规范化 URL，移除查询参数和哈希
function normalizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch (error) {
    // 对于无效 URL，返回原始字符串，尽管这种情况在扩展中较少见
    return urlString;
  }
}

/**
 * Get all page views with optimized loading
 * Uses memory cache and decompression for better performance
 * 
 * @param bypassCache - Whether to bypass the memory cache
 * @returns Promise resolving to array of page views
 */
export async function getAllPageViews(bypassCache: boolean = false): Promise<PageView[]> {
  return await loadData(STORAGE_KEYS.pageViews, [], bypassCache);
}

/**
 * Save a page view session and update related statistics
 * This function handles session merging, duration calculation, and aggregation
 * Optimized with batching and compression for large datasets
 * 
 * @param url - The URL of the page
 * @param session - The session data to save
 * @param faviconUrl - Optional favicon URL
 * @param pageTitle - Optional page title
 */
export async function savePageViewSession(
  url: string,
  session: PageViewSession,
  faviconUrl?: string,
  pageTitle?: string
): Promise<void> {
  try {
    // Check if we have the page views in memory cache first
    let pageViews = await getAllPageViews();
    const normalizedUrl = normalizeUrl(url);
    const urlObject = new URL(url);
    const currentTime = Date.now();
    const sessionDuration = (session.endTime - session.startTime) / 1000; // Convert to seconds
    
    // Skip very short sessions (less than 0.5 seconds) to avoid noise
    if (sessionDuration < 0.5) {
      console.debug(`Skipping very short session (${sessionDuration.toFixed(2)}s) for ${url}`);
      return;
    }

    let pageView = pageViews.find((pv) => pv.normalizedUrl === normalizedUrl);
    let sessionMerged = false;

    if (pageView) {
      // Check if we can merge this session with an existing one
      sessionMerged = tryMergeSession(pageView.sessions, session);
      
      if (sessionMerged) {
        // If session was merged, recalculate the total duration
        pageView.totalDuration = calculateTotalDuration(pageView.sessions);
        console.debug(`Merged session for ${url}, new duration: ${pageView.totalDuration.toFixed(2)}s`);
      } else {
        // If no merge happened, just add the new session and update duration
        pageView.sessions.push(session);
        pageView.totalDuration += sessionDuration;
        console.debug(`Added new session for ${url}, new duration: ${pageView.totalDuration.toFixed(2)}s`);
      }
      
      pageView.lastVisited = currentTime;
      
      // Update page title and favicon if provided
      if (pageTitle && (!pageView.pageTitle || pageView.pageTitle.length < pageTitle.length)) {
        // Prefer longer titles as they're usually more descriptive
        pageView.pageTitle = pageTitle;
      }
      
      if (faviconUrl && !pageView.faviconUrl) {
        pageView.faviconUrl = faviconUrl;
      }
    } else {
      // Create new PageView
      pageView = {
        url: url, // Original URL
        normalizedUrl: normalizedUrl,
        hostname: urlObject.hostname,
        pageTitle: pageTitle,
        faviconUrl: faviconUrl,
        sessions: [session],
        totalDuration: sessionDuration,
        lastVisited: currentTime,
        firstVisited: currentTime
      };
      pageViews.push(pageView);
      console.debug(`Created new page view for ${url}, duration: ${sessionDuration.toFixed(2)}s`);
    }

    // Save the updated page views using batching (not immediate)
    // This allows multiple rapid session updates to be batched together
    await saveData(STORAGE_KEYS.pageViews, pageViews, false);
    
    // Queue the statistics updates to be processed in batch
    // We use a separate batch operation for statistics to avoid blocking the UI
    setTimeout(async () => {
      try {
        // After updating the page view, update aggregated statistics
        await updateAggregatedStatistics(pageView);
        
        // Check if we should look for similar URLs to potentially merge
        // This helps with handling URL variations that point to the same content
        if (!sessionMerged && pageView.sessions.length <= 3) {
          // Only do this for pages with few sessions to avoid unnecessary processing
          await findAndMergeSimilarUrls(normalizedUrl, pageViews);
        }
      } catch (error) {
        console.error('Error in deferred page view processing:', error);
      }
    }, 100);
  } catch (error) {
    console.error(`Error saving page view session for ${url}:`, error);
  }
}

/**
 * Delete a specific page view
 * Optimized to update memory cache and use immediate storage write
 * 
 * @param url - URL of the page view to delete
 */
export async function deletePageView(url: string): Promise<void> {
  try {
    let pageViews = await getAllPageViews();
    const normalizedUrl = normalizeUrl(url);
    pageViews = pageViews.filter((pv) => pv.url !== normalizedUrl);
    
    // Use immediate write for deletion operations to ensure they take effect right away
    await saveData(STORAGE_KEYS.pageViews, pageViews, true);
    
    // Also clear any related cached data that might reference this page view
    delete memoryCache[STORAGE_KEYS.todayTimeStats];
    delete memoryCache[STORAGE_KEYS.weekTimeStats];
    delete memoryCache[STORAGE_KEYS.domainStats];
    
    console.log(`Deleted page view for ${url}`);
  } catch (error) {
    console.error(`Error deleting page view for ${url}:`, error);
  }
}

/**
 * Clear all page view data
 * Optimized to clear memory cache and use direct storage removal
 */
export async function clearAllPageViews(): Promise<void> {
  try {
    // Clear from storage
    await chrome.storage.local.remove(STORAGE_KEYS.pageViews);
    
    // Clear from memory cache
    delete memoryCache[STORAGE_KEYS.pageViews];
    delete memoryCache[STORAGE_KEYS.todayTimeStats];
    delete memoryCache[STORAGE_KEYS.weekTimeStats];
    delete memoryCache[STORAGE_KEYS.domainStats];
    
    console.log('All page view data cleared successfully');
  } catch (error) {
    console.error("Error clearing page views:", error);
  }
}

/**
 * Try to merge a new session with existing sessions if they are close enough in time
 * This helps consolidate fragmented sessions caused by brief tab switches or visibility changes
 * 
 * @param existingSessions - Array of existing sessions for a page
 * @param newSession - New session to potentially merge
 * @returns Boolean indicating if a merge occurred
 */
export function tryMergeSession(existingSessions: PageViewSession[], newSession: PageViewSession): boolean {
  // Don't attempt to merge if there are no existing sessions
  if (existingSessions.length === 0) {
    return false;
  }
  
  // Sort sessions by end time to find the most recent one
  const sortedSessions = [...existingSessions].sort((a, b) => b.endTime - a.endTime);
  const mostRecentSession = sortedSessions[0];
  
  // Define the maximum gap between sessions that can be merged (30 seconds)
  const MAX_MERGE_GAP_MS = 30 * 1000;
  
  // Check if the new session starts close enough to when the most recent session ended
  const timeBetweenSessions = newSession.startTime - mostRecentSession.endTime;
  
  if (timeBetweenSessions >= 0 && timeBetweenSessions <= MAX_MERGE_GAP_MS) {
    // Merge the sessions by extending the end time of the most recent session
    mostRecentSession.endTime = Math.max(mostRecentSession.endTime, newSession.endTime);
    
    // Update the active status - if either session was active, consider the merged session active
    mostRecentSession.active = mostRecentSession.active || newSession.active;
    
    return true;
  }
  
  // Check for overlapping sessions (can happen due to async message handling)
  if (newSession.startTime <= mostRecentSession.endTime && newSession.endTime >= mostRecentSession.startTime) {
    // Merge overlapping sessions by taking the earliest start and latest end
    mostRecentSession.startTime = Math.min(mostRecentSession.startTime, newSession.startTime);
    mostRecentSession.endTime = Math.max(mostRecentSession.endTime, newSession.endTime);
    
    // Update the active status
    mostRecentSession.active = mostRecentSession.active || newSession.active;
    
    return true;
  }
  
  // Check for sessions that are part of the same browsing "flow"
  // If the user navigates between pages on the same domain in quick succession,
  // we might want to consider these as part of the same logical session
  const isSameDomainSession = sortedSessions.some(session => {
    // If sessions are within 5 minutes of each other, consider them related
    const MAX_RELATED_SESSION_GAP_MS = 5 * 60 * 1000;
    const timeBetween = Math.abs(newSession.startTime - session.endTime);
    return timeBetween <= MAX_RELATED_SESSION_GAP_MS;
  });
  
  // If it's part of the same browsing flow, we don't merge but we mark it
  // This information can be used for analytics purposes
  if (isSameDomainSession) {
    // We could add a "relatedToSession" property if needed in the future
    // For now, we just return false as we're not actually merging
    return false;
  }
  
  return false;
}

/**
 * Calculate the total duration from all sessions
 * This ensures accurate duration calculation even after merging sessions
 * 
 * @param sessions - Array of page view sessions
 * @returns Total duration in seconds
 */
export function calculateTotalDuration(sessions: PageViewSession[]): number {
  return sessions.reduce((total, session) => {
    const sessionDuration = (session.endTime - session.startTime) / 1000; // Convert to seconds
    return total + (sessionDuration > 0 ? sessionDuration : 0); // Ensure no negative durations
  }, 0);
}

/**
 * Update aggregated statistics when a page view is updated
 * This ensures that domain statistics and time-based aggregations are kept up-to-date
 * 
 * @param pageView - The page view that was updated
 */
export async function updateAggregatedStatistics(pageView: PageView): Promise<void> {
  try {
    // Update domain statistics
    await updateDomainStatistics(pageView);
    
    // Update today's time statistics if the page view has sessions from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const hasSessionsToday = pageView.sessions.some(session => 
      session.startTime >= today.getTime() && session.startTime <= todayEnd.getTime()
    );
    
    if (hasSessionsToday) {
      await updateTodayTimeStats();
    }
    
    // Update weekly statistics if the page view has sessions from this week
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    
    const hasSessionsThisWeek = pageView.sessions.some(session => 
      session.startTime >= startOfWeek.getTime() && session.startTime <= todayEnd.getTime()
    );
    
    if (hasSessionsThisWeek) {
      await updateWeekTimeStats();
    }
    
    // Update monthly statistics if needed
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const hasSessionsThisMonth = pageView.sessions.some(session => 
      session.startTime >= startOfMonth.getTime() && session.startTime <= todayEnd.getTime()
    );
    
    if (hasSessionsThisMonth) {
      await updateMonthlyAggregation();
    }
    
    // Recalculate total duration for the page view to ensure accuracy
    // This is important after session merging
    await recalculatePageViewDuration(pageView.normalizedUrl);
  } catch (error) {
    console.error('Error updating aggregated statistics:', error);
  }
}

/**
 * Update domain-based statistics
 * Aggregates time spent on each domain
 * 
 * @param pageView - The page view that was updated
 */
export async function updateDomainStatistics(pageView: PageView): Promise<void> {
  try {
    // Load existing domain statistics
    const domainStats = await loadData<Record<string, number>>(STORAGE_KEYS.domainStats, {});
    
    // Get the domain from the page view
    const domain = pageView.hostname;
    
    // Calculate total time spent on this domain
    const allPageViews = await getAllPageViews();
    const domainPageViews = allPageViews.filter(pv => pv.hostname === domain);
    
    // Sum up all durations for this domain
    const totalDomainDuration = domainPageViews.reduce(
      (total, pv) => total + pv.totalDuration, 
      0
    );
    
    // Update the domain statistics
    domainStats[domain] = totalDomainDuration;
    
    // Save the updated domain statistics
    await saveData(STORAGE_KEYS.domainStats, domainStats);
  } catch (error) {
    console.error('Error updating domain statistics:', error);
  }
}

/**
 * Update time statistics for today
 * This is called when a page view with sessions from today is updated
 */
export async function updateTodayTimeStats(): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    // Calculate today's time statistics
    const todayTimeStats = await getTimeStatsByDateRange(today, today);
    
    // Save the updated statistics
    await saveData(STORAGE_KEYS.todayTimeStats, todayTimeStats);
    
    console.log('Today\'s time statistics updated successfully');
  } catch (error) {
    console.error('Error updating today\'s time statistics:', error);
  }
}

/**
 * Update time statistics for the current week
 * This is called when a page view with sessions from this week is updated
 */
export async function updateWeekTimeStats(): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get the start of the current week (Sunday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    // Calculate this week's time statistics
    const weekTimeStats = await getTimeStatsByDateRange(startOfWeek, today);
    
    // Save the updated statistics
    await saveData(STORAGE_KEYS.weekTimeStats, weekTimeStats);
    
    console.log('Weekly time statistics updated successfully');
  } catch (error) {
    console.error('Error updating weekly time statistics:', error);
  }
}

/**
 * Get aggregated time statistics for a specific date range
 * 
 * @param startDate - Start date for the statistics
 * @param endDate - End date for the statistics
 * @returns Promise resolving to time tracking statistics
 */
export async function getTimeStatsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<TimeTrackingStats> {
  // Get all page views
  const allPageViews = await getAllPageViews();
  
  // Convert dates to timestamps for comparison
  const startTimestamp = startDate.getTime();
  const endTimestamp = endDate.getTime() + (24 * 60 * 60 * 1000 - 1); // Include the full end date
  
  // Filter sessions within the date range and calculate statistics
  const filteredPageViews = allPageViews.map(pageView => {
    // Create a copy of the page view with filtered sessions
    const filteredSessions = pageView.sessions.filter(session => 
      session.startTime >= startTimestamp && session.startTime <= endTimestamp
    );
    
    if (filteredSessions.length === 0) {
      return null; // No sessions in the date range
    }
    
    return {
      ...pageView,
      sessions: filteredSessions,
      totalDuration: calculateTotalDuration(filteredSessions)
    };
  }).filter(Boolean) as PageView[];
  
  // Calculate total time for the period
  const totalTimeSeconds = filteredPageViews.reduce(
    (total, pageView) => total + pageView.totalDuration, 
    0
  );
  
  // Get top sites by time spent
  const topSites = [...filteredPageViews]
    .sort((a, b) => b.totalDuration - a.totalDuration)
    .slice(0, 10);
  
  // Calculate time distribution by domain
  const domainDistribution: Record<string, number> = {};
  filteredPageViews.forEach(pageView => {
    const domain = pageView.hostname;
    domainDistribution[domain] = (domainDistribution[domain] || 0) + pageView.totalDuration;
  });
  
  // Calculate hourly distribution
  const hourlyDistribution: Record<number, number> = {};
  for (let i = 0; i < 24; i++) {
    hourlyDistribution[i] = 0;
  }
  
  filteredPageViews.forEach(pageView => {
    pageView.sessions.forEach(session => {
      // For each session, distribute its time across the hours it spans
      let currentTime = session.startTime;
      while (currentTime < session.endTime) {
        const date = new Date(currentTime);
        const hour = date.getHours();
        
        // Calculate how much time was spent in this hour
        const hourEnd = new Date(date);
        hourEnd.setHours(hour + 1, 0, 0, 0);
        
        const timeInHour = Math.min(
          (Math.min(hourEnd.getTime(), session.endTime) - currentTime) / 1000,
          3600 // Cap at one hour
        );
        
        hourlyDistribution[hour] += timeInHour;
        
        // Move to the next hour
        currentTime = hourEnd.getTime();
      }
    });
  });
  
  return {
    totalTimeToday: totalTimeSeconds,
    topSites,
    domainDistribution,
    hourlyDistribution
  };
}
/**
 * Update monthly aggregated statistics
 * This provides a monthly view of browsing patterns
 */
export async function updateMonthlyAggregation(): Promise<void> {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Calculate monthly time statistics
    const monthlyStats = await getTimeStatsByDateRange(startOfMonth, today);
    
    // Save the monthly statistics with a key that includes the year and month
    const monthKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    await saveData(`monthly-time-stats-${monthKey}`, monthlyStats);
    
    console.log(`Monthly time statistics for ${monthKey} updated successfully`);
  } catch (error) {
    console.error('Error updating monthly time statistics:', error);
  }
}

/**
 * Recalculate the total duration for a specific page view
 * This ensures that the total duration is accurate after session merging
 * 
 * @param normalizedUrl - The normalized URL of the page view to recalculate
 */
export async function recalculatePageViewDuration(normalizedUrl: string): Promise<void> {
  try {
    const pageViews = await getAllPageViews();
    const pageViewIndex = pageViews.findIndex(pv => pv.normalizedUrl === normalizedUrl);
    
    if (pageViewIndex === -1) {
      console.warn(`Page view with URL ${normalizedUrl} not found for recalculation`);
      return;
    }
    
    // Get the page view
    const pageView = pageViews[pageViewIndex];
    
    // Recalculate the total duration
    pageView.totalDuration = calculateTotalDuration(pageView.sessions);
    
    // Update the page view in the array
    pageViews[pageViewIndex] = pageView;
    
    // Save the updated page views
    await saveData(STORAGE_KEYS.pageViews, pageViews);
    
    console.log(`Recalculated duration for ${normalizedUrl}: ${pageView.totalDuration.toFixed(2)} seconds`);
  } catch (error) {
    console.error(`Error recalculating page view duration for ${normalizedUrl}:`, error);
  }
}

/**
 * Get aggregated statistics for a specific domain
 * 
 * @param domain - The domain to get statistics for
 * @returns Promise resolving to time tracking statistics for the domain
 */
export async function getDomainStatistics(domain: string): Promise<TimeTrackingStats | null> {
  try {
    const allPageViews = await getAllPageViews();
    
    // Filter page views for the specified domain
    const domainPageViews = allPageViews.filter(pv => pv.hostname === domain);
    
    if (domainPageViews.length === 0) {
      return null;
    }
    
    // Calculate total time spent on this domain
    const totalTimeSeconds = domainPageViews.reduce(
      (total, pv) => total + pv.totalDuration, 
      0
    );
    
    // Get top pages for this domain
    const topSites = [...domainPageViews]
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, 10);
    
    // Calculate hourly distribution for this domain
    const hourlyDistribution: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      hourlyDistribution[i] = 0;
    }
    
    domainPageViews.forEach(pageView => {
      pageView.sessions.forEach(session => {
        // For each session, distribute its time across the hours it spans
        let currentTime = session.startTime;
        while (currentTime < session.endTime) {
          const date = new Date(currentTime);
          const hour = date.getHours();
          
          // Calculate how much time was spent in this hour
          const hourEnd = new Date(date);
          hourEnd.setHours(hour + 1, 0, 0, 0);
          
          const timeInHour = Math.min(
            (Math.min(hourEnd.getTime(), session.endTime) - currentTime) / 1000,
            3600 // Cap at one hour
          );
          
          hourlyDistribution[hour] += timeInHour;
          
          // Move to the next hour
          currentTime = hourEnd.getTime();
        }
      });
    });
    
    // For a single domain, the domain distribution is just this domain
    const domainDistribution: Record<string, number> = {
      [domain]: totalTimeSeconds
    };
    
    return {
      totalTimeToday: totalTimeSeconds,
      topSites,
      domainDistribution,
      hourlyDistribution
    };
  } catch (error) {
    console.error(`Error getting domain statistics for ${domain}:`, error);
    return null;
  }
}

/**
 * Merge page views for the same content across different URLs
 * This is useful for handling URL variations that point to the same content
 * 
 * @param primaryUrl - The primary URL to merge other page views into
 * @param urlsToMerge - Array of URLs to merge into the primary URL
 */
export async function mergePageViews(primaryUrl: string, urlsToMerge: string[]): Promise<void> {
  try {
    const pageViews = await getAllPageViews();
    const normalizedPrimaryUrl = normalizeUrl(primaryUrl);
    
    // Find the primary page view
    const primaryPageViewIndex = pageViews.findIndex(pv => pv.normalizedUrl === normalizedPrimaryUrl);
    
    if (primaryPageViewIndex === -1) {
      console.warn(`Primary page view with URL ${normalizedPrimaryUrl} not found for merging`);
      return;
    }
    
    const primaryPageView = pageViews[primaryPageViewIndex];
    let sessionsAdded = false;
    
    // Process each URL to merge
    for (const urlToMerge of urlsToMerge) {
      const normalizedUrlToMerge = normalizeUrl(urlToMerge);
      
      // Skip if it's the same as the primary URL
      if (normalizedUrlToMerge === normalizedPrimaryUrl) {
        continue;
      }
      
      // Find the page view to merge
      const pageViewToMergeIndex = pageViews.findIndex(pv => pv.normalizedUrl === normalizedUrlToMerge);
      
      if (pageViewToMergeIndex === -1) {
        continue;
      }
      
      const pageViewToMerge = pageViews[pageViewToMergeIndex];
      
      // Merge sessions
      primaryPageView.sessions = [...primaryPageView.sessions, ...pageViewToMerge.sessions];
      
      // Update first visited time if the merged page view has an earlier first visit
      if (pageViewToMerge.firstVisited < primaryPageView.firstVisited) {
        primaryPageView.firstVisited = pageViewToMerge.firstVisited;
      }
      
      // Update last visited time if the merged page view has a later last visit
      if (pageViewToMerge.lastVisited > primaryPageView.lastVisited) {
        primaryPageView.lastVisited = pageViewToMerge.lastVisited;
      }
      
      // Remove the merged page view
      pageViews.splice(pageViewToMergeIndex, 1);
      sessionsAdded = true;
    }
    
    // Recalculate total duration if sessions were added
    if (sessionsAdded) {
      primaryPageView.totalDuration = calculateTotalDuration(primaryPageView.sessions);
      
      // Update the primary page view in the array
      pageViews[primaryPageViewIndex] = primaryPageView;
      
      // Save the updated page views
      await saveData(STORAGE_KEYS.pageViews, pageViews);
      
      console.log(`Merged page views into ${normalizedPrimaryUrl}, new total duration: ${primaryPageView.totalDuration.toFixed(2)} seconds`);
      
      // Update aggregated statistics
      await updateAggregatedStatistics(primaryPageView);
    }
  } catch (error) {
    console.error(`Error merging page views into ${primaryUrl}:`, error);
  }
}/*
*
 * Find and merge similar URLs that likely point to the same content
 * This helps consolidate page views for the same content with different URL variations
 * 
 * @param normalizedUrl - The normalized URL to find similar URLs for
 * @param pageViews - Array of all page views (optional, will be loaded if not provided)
 */
export async function findAndMergeSimilarUrls(normalizedUrl: string, existingPageViews?: PageView[]): Promise<void> {
  try {
    const pageViews = existingPageViews || await getAllPageViews();
    const pageView = pageViews.find(pv => pv.normalizedUrl === normalizedUrl);
    
    if (!pageView) {
      console.warn(`Page view with URL ${normalizedUrl} not found for finding similar URLs`);
      return;
    }
    
    // Extract the base parts of the URL for comparison
    const urlObj = new URL(pageView.url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    
    // Find potential similar URLs
    const similarUrls: string[] = [];
    const similarPageViews = pageViews.filter(pv => {
      // Skip the current page view
      if (pv.normalizedUrl === normalizedUrl) {
        return false;
      }
      
      try {
        const otherUrlObj = new URL(pv.url);
        
        // Check if the hostnames match
        if (otherUrlObj.hostname !== hostname) {
          return false;
        }
        
        // Check for pathname similarity
        // This is a simple check that can be enhanced with more sophisticated algorithms
        const pathnameSimilarity = calculatePathSimilarity(pathname, otherUrlObj.pathname);
        
        // If the paths are very similar (e.g., differ only by a trailing slash or minor variation)
        if (pathnameSimilarity > 0.8) {
          similarUrls.push(pv.url);
          return true;
        }
        
        return false;
      } catch (error) {
        return false;
      }
    });
    
    // If we found similar URLs, merge them
    if (similarUrls.length > 0) {
      console.log(`Found ${similarUrls.length} similar URLs for ${pageView.url}`);
      await mergePageViews(pageView.url, similarUrls);
    }
  } catch (error) {
    console.error(`Error finding similar URLs for ${normalizedUrl}:`, error);
  }
}

/**
 * Calculate similarity between two URL paths
 * This is a simple implementation that can be enhanced with more sophisticated algorithms
 * 
 * @param path1 - First path to compare
 * @param path2 - Second path to compare
 * @returns Similarity score between 0 and 1
 */
function calculatePathSimilarity(path1: string, path2: string): number {
  // Normalize paths by removing trailing slashes
  const normalizedPath1 = path1.endsWith('/') ? path1.slice(0, -1) : path1;
  const normalizedPath2 = path2.endsWith('/') ? path2.slice(0, -1) : path2;
  
  // If paths are identical after normalization, they're 100% similar
  if (normalizedPath1 === normalizedPath2) {
    return 1;
  }
  
  // Split paths into segments
  const segments1 = normalizedPath1.split('/').filter(Boolean);
  const segments2 = normalizedPath2.split('/').filter(Boolean);
  
  // If one path is empty and the other isn't, they're not similar
  if ((segments1.length === 0 && segments2.length > 0) || 
      (segments2.length === 0 && segments1.length > 0)) {
    return 0;
  }
  
  // Count matching segments
  let matchingSegments = 0;
  const minSegments = Math.min(segments1.length, segments2.length);
  
  for (let i = 0; i < minSegments; i++) {
    if (segments1[i] === segments2[i]) {
      matchingSegments++;
    } else {
      // If segments differ but are similar (e.g., numeric IDs), consider partial match
      const similarity = calculateStringSimilarity(segments1[i], segments2[i]);
      if (similarity > 0.5) {
        matchingSegments += similarity;
      } else {
        break; // Stop at first significant difference
      }
    }
  }
  
  // Calculate similarity as ratio of matching segments to max path length
  return matchingSegments / Math.max(segments1.length, segments2.length);
}

/**
 * Calculate similarity between two strings
 * Uses a simple implementation of Levenshtein distance
 * 
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Similarity score between 0 and 1
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  // If either string is empty, similarity depends on the other string's length
  if (str1.length === 0) return str2.length === 0 ? 1 : 0;
  if (str2.length === 0) return 0;
  
  // Check if both strings are numeric (likely IDs)
  const isNumeric1 = /^\d+$/.test(str1);
  const isNumeric2 = /^\d+$/.test(str2);
  
  // If both are numeric, they're likely IDs and should be considered different
  if (isNumeric1 && isNumeric2) {
    return 0.3; // Give some similarity but not much
  }
  
  // Check for exact match
  if (str1 === str2) return 1;
  
  // Check for case-insensitive match
  if (str1.toLowerCase() === str2.toLowerCase()) return 0.9;
  
  // Calculate Levenshtein distance
  const matrix: number[][] = [];
  
  // Initialize matrix
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  // Calculate similarity from distance
  const distance = matrix[str1.length][str2.length];
  const maxLength = Math.max(str1.length, str2.length);
  
  return 1 - distance / maxLength;
}/**

 * Get page views by date range
 * This function filters page views based on session start times within the specified date range
 * 
 * @param startDate - Start date for filtering
 * @param endDate - End date for filtering
 * @returns Promise resolving to filtered page views
 */
export async function getPageViewsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<PageView[]> {
  try {
    // Get all page views
    const allPageViews = await getAllPageViews();
    
    // Convert dates to timestamps for comparison
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime() + (24 * 60 * 60 * 1000 - 1); // Include the full end date
    
    // Filter page views that have sessions within the date range
    const filteredPageViews = allPageViews.map(pageView => {
      // Create a copy of the page view with filtered sessions
      const filteredSessions = pageView.sessions.filter(session => 
        session.startTime >= startTimestamp && session.startTime <= endTimestamp
      );
      
      if (filteredSessions.length === 0) {
        return null; // No sessions in the date range
      }
      
      return {
        ...pageView,
        sessions: filteredSessions,
        totalDuration: calculateTotalDuration(filteredSessions)
      };
    }).filter(Boolean) as PageView[];
    
    return filteredPageViews;
  } catch (error) {
    console.error('Error getting page views by date range:', error);
    return [];
  }
}

/**
 * Get page views for a specific date
 * 
 * @param date - The date to get page views for
 * @returns Promise resolving to page views for the specified date
 */
export async function getPageViewsByDate(date: Date): Promise<PageView[]> {
  // Create start and end dates for the specified date
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  
  return getPageViewsByDateRange(startDate, endDate);
}

/**
 * Get page views by domain
 * 
 * @param domain - The domain to filter by
 * @returns Promise resolving to page views for the specified domain
 */
export async function getPageViewsByDomain(domain: string): Promise<PageView[]> {
  try {
    const allPageViews = await getAllPageViews();
    return allPageViews.filter(pageView => pageView.hostname === domain);
  } catch (error) {
    console.error(`Error getting page views for domain ${domain}:`, error);
    return [];
  }
}

/**
 * Get page views by domain and date range
 * 
 * @param domain - The domain to filter by
 * @param startDate - Start date for filtering
 * @param endDate - End date for filtering
 * @returns Promise resolving to filtered page views
 */
export async function getPageViewsByDomainAndDateRange(
  domain: string,
  startDate: Date,
  endDate: Date
): Promise<PageView[]> {
  try {
    const pageViewsByDate = await getPageViewsByDateRange(startDate, endDate);
    return pageViewsByDate.filter(pageView => pageView.hostname === domain);
  } catch (error) {
    console.error(`Error getting page views for domain ${domain} in date range:`, error);
    return [];
  }
}

/**
 * Save page views for a specific date
 * This helps with date-based organization and retrieval
 * 
 * @param date - The date to save page views for
 * @param pageViews - The page views to save
 */
export async function savePageViewsByDate(date: Date, pageViews: PageView[]): Promise<void> {
  try {
    // Format date as YYYY-MM-DD
    const dateString = date.toISOString().split('T')[0];
    
    // Save page views with the date-specific key
    await saveData(STORAGE_KEYS.pageViewsByDate(dateString), pageViews);
    
    // Update the list of available dates
    const availableDates = await loadData<string[]>(STORAGE_KEYS.availableDates, []);
    if (!availableDates.includes(dateString)) {
      availableDates.push(dateString);
      await saveData(STORAGE_KEYS.availableDates, availableDates);
    }
  } catch (error) {
    console.error(`Error saving page views for date ${date.toISOString()}:`, error);
  }
}

/**
 * Load page views for a specific date
 * 
 * @param date - The date to load page views for
 * @returns Promise resolving to page views for the specified date
 */
export async function loadPageViewsByDate(date: Date): Promise<PageView[]> {
  try {
    // Format date as YYYY-MM-DD
    const dateString = date.toISOString().split('T')[0];
    
    // Try to load from date-specific storage first
    const storedPageViews = await loadData<PageView[]>(
      STORAGE_KEYS.pageViewsByDate(dateString), 
      []
    );
    
    // If we have stored page views for this date, return them
    if (storedPageViews.length > 0) {
      return storedPageViews;
    }
    
    // Otherwise, filter from all page views
    return getPageViewsByDate(date);
  } catch (error) {
    console.error(`Error loading page views for date ${date.toISOString()}:`, error);
    return [];
  }
}

/**
 * Organize page views by date
 * This function processes all page views and organizes them by date
 * for more efficient date-based retrieval
 */
export async function organizePageViewsByDate(): Promise<void> {
  try {
    // Get all page views
    const allPageViews = await getAllPageViews();
    
    // Create a map to store page views by date
    const pageViewsByDate: Record<string, PageView[]> = {};
    
    // Process each page view
    for (const pageView of allPageViews) {
      // Process each session
      for (const session of pageView.sessions) {
        // Get the date for this session
        const sessionDate = new Date(session.startTime);
        const dateString = sessionDate.toISOString().split('T')[0];
        
        // Create a copy of the page view with only this session
        const pageViewCopy = {
          ...pageView,
          sessions: [session],
          totalDuration: (session.endTime - session.startTime) / 1000
        };
        
        // Add to the map
        if (!pageViewsByDate[dateString]) {
          pageViewsByDate[dateString] = [];
        }
        
        // Check if we already have this page view for this date
        const existingPageViewIndex = pageViewsByDate[dateString].findIndex(
          pv => pv.normalizedUrl === pageView.normalizedUrl
        );
        
        if (existingPageViewIndex >= 0) {
          // Add the session to the existing page view
          const existingPageView = pageViewsByDate[dateString][existingPageViewIndex];
          existingPageView.sessions.push(session);
          existingPageView.totalDuration += (session.endTime - session.startTime) / 1000;
          
          // Update last visited time if needed
          if (session.endTime > existingPageView.lastVisited) {
            existingPageView.lastVisited = session.endTime;
          }
          
          // Update first visited time if needed
          if (session.startTime < existingPageView.firstVisited) {
            existingPageView.firstVisited = session.startTime;
          }
        } else {
          // Add the new page view
          pageViewsByDate[dateString].push(pageViewCopy);
        }
      }
    }
    
    // Save page views by date
    const availableDates: string[] = [];
    for (const dateString of Object.keys(pageViewsByDate)) {
      const date = new Date(dateString);
      await savePageViewsByDate(date, pageViewsByDate[dateString]);
      availableDates.push(dateString);
    }
    
    // Update the list of available dates
    await saveData(STORAGE_KEYS.availableDates, availableDates);
    
    console.log(`Organized page views by date for ${availableDates.length} dates`);
  } catch (error) {
    console.error('Error organizing page views by date:', error);
  }
}

/**
 * Enhanced save page view session method
 * This method saves the session and also updates date-based storage
 * 
 * @param url - The URL of the page
 * @param session - The session data to save
 * @param faviconUrl - Optional favicon URL
 * @param pageTitle - Optional page title
 */
export async function savePageViewSessionEnhanced(
  url: string,
  session: PageViewSession,
  faviconUrl?: string,
  pageTitle?: string
): Promise<void> {
  // First, save using the original method
  await savePageViewSession(url, session, faviconUrl, pageTitle);
  
  // Then, update date-based storage
  try {
    // Get the date for this session
    const sessionDate = new Date(session.startTime);
    sessionDate.setHours(0, 0, 0, 0);
    
    // Get page views for this date
    const pageViewsForDate = await getPageViewsByDate(sessionDate);
    
    // Save the updated page views for this date
    await savePageViewsByDate(sessionDate, pageViewsForDate);
  } catch (error) {
    console.error(`Error updating date-based storage for ${url}:`, error);
  }
}/**

 * Delete page view data for a specific URL
 * This function removes all data for the specified URL from both the main storage
 * and date-based storage
 * 
 * @param url - The URL to delete data for
 * @returns Promise resolving when deletion is complete
 */
export async function deletePageViewData(url: string): Promise<void> {
  try {
    // Normalize the URL for consistent matching
    const normalizedUrl = normalizeUrl(url);
    
    // Get all page views
    const allPageViews = await getAllPageViews();
    
    // Filter out the page view to delete
    const updatedPageViews = allPageViews.filter(pv => pv.normalizedUrl !== normalizedUrl);
    
    // Save the updated page views
    await saveData(STORAGE_KEYS.pageViews, updatedPageViews);
    
    // Update date-based storage
    // Get all available dates
    const availableDates = await loadData<string[]>(STORAGE_KEYS.availableDates, []);
    
    // Process each date
    for (const dateString of availableDates) {
      // Load page views for this date
      const dateKey = STORAGE_KEYS.pageViewsByDate(dateString);
      const pageViewsForDate = await loadData<PageView[]>(dateKey, []);
      
      // Filter out the page view to delete
      const updatedPageViewsForDate = pageViewsForDate.filter(pv => pv.normalizedUrl !== normalizedUrl);
      
      // Save the updated page views for this date
      await saveData(dateKey, updatedPageViewsForDate);
    }
    
    // Update aggregated statistics
    await updateTodayTimeStats();
    await updateWeekTimeStats();
    await updateMonthlyAggregation();
    
    console.log(`Deleted page view data for ${url}`);
  } catch (error) {
    console.error(`Error deleting page view data for ${url}:`, error);
  }
}

/**
 * Delete page view data for a specific domain
 * This function removes all data for the specified domain from both the main storage
 * and date-based storage
 * 
 * @param domain - The domain to delete data for
 * @returns Promise resolving when deletion is complete
 */
export async function deletePageViewDataByDomain(domain: string): Promise<void> {
  try {
    // Get all page views
    const allPageViews = await getAllPageViews();
    
    // Filter out page views for the specified domain
    const updatedPageViews = allPageViews.filter(pv => pv.hostname !== domain);
    
    // Save the updated page views
    await saveData(STORAGE_KEYS.pageViews, updatedPageViews);
    
    // Update date-based storage
    // Get all available dates
    const availableDates = await loadData<string[]>(STORAGE_KEYS.availableDates, []);
    
    // Process each date
    for (const dateString of availableDates) {
      // Load page views for this date
      const dateKey = STORAGE_KEYS.pageViewsByDate(dateString);
      const pageViewsForDate = await loadData<PageView[]>(dateKey, []);
      
      // Filter out page views for the specified domain
      const updatedPageViewsForDate = pageViewsForDate.filter(pv => pv.hostname !== domain);
      
      // Save the updated page views for this date
      await saveData(dateKey, updatedPageViewsForDate);
    }
    
    // Update aggregated statistics
    await updateTodayTimeStats();
    await updateWeekTimeStats();
    await updateMonthlyAggregation();
    
    console.log(`Deleted page view data for domain ${domain}`);
  } catch (error) {
    console.error(`Error deleting page view data for domain ${domain}:`, error);
  }
}

/**
 * Delete page view data for a specific date
 * This function removes all data for the specified date
 * 
 * @param date - The date to delete data for
 * @returns Promise resolving when deletion is complete
 */
export async function deletePageViewDataByDate(date: Date): Promise<void> {
  try {
    // Format date as YYYY-MM-DD
    const dateString = date.toISOString().split('T')[0];
    
    // Remove from date-based storage
    const dateKey = STORAGE_KEYS.pageViewsByDate(dateString);
    await chrome.storage.local.remove(dateKey);
    
    // Update the list of available dates
    const availableDates = await loadData<string[]>(STORAGE_KEYS.availableDates, []);
    const updatedDates = availableDates.filter(d => d !== dateString);
    await saveData(STORAGE_KEYS.availableDates, updatedDates);
    
    // Update main storage by filtering out sessions from this date
    const allPageViews = await getAllPageViews();
    const startTimestamp = date.getTime();
    const endTimestamp = startTimestamp + (24 * 60 * 60 * 1000 - 1);
    
    const updatedPageViews = allPageViews.map(pageView => {
      // Filter out sessions for this date
      const filteredSessions = pageView.sessions.filter(session => 
        !(session.startTime >= startTimestamp && session.startTime <= endTimestamp)
      );
      
      if (filteredSessions.length === 0) {
        return null; // Remove this page view if it has no sessions left
      }
      
      return {
        ...pageView,
        sessions: filteredSessions,
        totalDuration: calculateTotalDuration(filteredSessions)
      };
    }).filter(Boolean) as PageView[];
    
    // Save the updated page views
    await saveData(STORAGE_KEYS.pageViews, updatedPageViews);
    
    // Update aggregated statistics
    await updateTodayTimeStats();
    await updateWeekTimeStats();
    await updateMonthlyAggregation();
    
    console.log(`Deleted page view data for date ${dateString}`);
  } catch (error) {
    console.error(`Error deleting page view data for date ${dateString}:`, error);
  }
}

/**
 * Clean up old page view data
 * This function removes data older than the specified number of days
 * 
 * @param maxAgeDays - Maximum age of data to keep in days
 * @returns Promise resolving when cleanup is complete
 */
export async function cleanupOldPageViewData(maxAgeDays: number): Promise<void> {
  try {
    // Calculate the cutoff date
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);
    const cutoffTimestamp = cutoffDate.getTime();
    
    console.log(`Cleaning up page view data older than ${cutoffDate.toISOString()}`);
    
    // Get all page views
    const allPageViews = await getAllPageViews();
    
    // Filter out sessions older than the cutoff date
    const updatedPageViews = allPageViews.map(pageView => {
      // Filter out old sessions
      const filteredSessions = pageView.sessions.filter(session => 
        session.startTime >= cutoffTimestamp
      );
      
      if (filteredSessions.length === 0) {
        return null; // Remove this page view if it has no sessions left
      }
      
      return {
        ...pageView,
        sessions: filteredSessions,
        totalDuration: calculateTotalDuration(filteredSessions)
      };
    }).filter(Boolean) as PageView[];
    
    // Save the updated page views
    await saveData(STORAGE_KEYS.pageViews, updatedPageViews);
    
    // Update date-based storage
    // Get all available dates
    const availableDates = await loadData<string[]>(STORAGE_KEYS.availableDates, []);
    
    // Filter out dates older than the cutoff date
    const updatedDates = availableDates.filter(dateString => {
      const date = new Date(dateString);
      return date.getTime() >= cutoffDate.getTime();
    });
    
    // Remove old date-based storage
    const datesToRemove = availableDates.filter(dateString => !updatedDates.includes(dateString));
    for (const dateString of datesToRemove) {
      const dateKey = STORAGE_KEYS.pageViewsByDate(dateString);
      await chrome.storage.local.remove(dateKey);
    }
    
    // Save the updated list of available dates
    await saveData(STORAGE_KEYS.availableDates, updatedDates);
    
    // Update aggregated statistics
    await updateTodayTimeStats();
    await updateWeekTimeStats();
    await updateMonthlyAggregation();
    
    console.log(`Cleaned up page view data older than ${maxAgeDays} days`);
    console.log(`Removed ${allPageViews.length - updatedPageViews.length} page views and ${datesToRemove.length} dates`);
  } catch (error) {
    console.error(`Error cleaning up old page view data:`, error);
  }
}

/**
 * Automatically clean up old page view data based on user settings
 * This function is called periodically to ensure storage doesn't grow too large
 * 
 * @param overrideMaxAgeDays - Optional parameter to override the default retention period
 * @returns Promise resolving when cleanup is complete
 */
export async function autoCleanupPageViewData(overrideMaxAgeDays?: number): Promise<void> {
  try {
    // Get user settings
    const settings = await loadData<UserSettings>(STORAGE_KEYS.userSettings, {
      collectData: true,
      collectionFrequency: "daily",
      excludeIncognito: true,
      excludedDomains: [],
      trackPageViewDuration: true,
      inactivityThresholdMinutes: 5,
      pauseOnInactivity: true,
      pageViewStorageDays: 30
    });
    
    // Use the override value if provided, otherwise use the setting
    const maxAgeDays = overrideMaxAgeDays !== undefined ? overrideMaxAgeDays : (settings.pageViewStorageDays || 30);
    
    // If the override value is provided, update the user settings
    if (overrideMaxAgeDays !== undefined) {
      settings.pageViewStorageDays = overrideMaxAgeDays;
      await saveData(STORAGE_KEYS.userSettings, settings);
      console.log(`Updated page view storage retention period to ${overrideMaxAgeDays} days`);
    }
    
    // Clean up data older than the specified number of days
    await cleanupOldPageViewData(maxAgeDays);
  } catch (error) {
    console.error('Error during automatic page view data cleanup:', error);
  }
}/**
 *
 Get storage usage statistics for page view data
 * This function calculates how much storage is being used by page view data
 * 
 * @returns Promise resolving to storage usage statistics
 */
export async function getPageViewStorageUsage(): Promise<{
  totalEntries: number;
  totalSessions: number;
  oldestDate: string | null;
  newestDate: string | null;
  estimatedSizeBytes: number;
  entriesByDomain: Record<string, number>;
}> {
  try {
    // Get all page views
    const allPageViews = await getAllPageViews();
    
    // Calculate statistics
    let totalSessions = 0;
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;
    const entriesByDomain: Record<string, number> = {};
    
    // Process each page view
    allPageViews.forEach(pageView => {
      // Count sessions
      totalSessions += pageView.sessions.length;
      
      // Track domain statistics
      const domain = pageView.hostname;
      entriesByDomain[domain] = (entriesByDomain[domain] || 0) + 1;
      
      // Track oldest and newest timestamps
      pageView.sessions.forEach(session => {
        if (session.startTime < oldestTimestamp) {
          oldestTimestamp = session.startTime;
        }
        if (session.endTime > newestTimestamp) {
          newestTimestamp = session.endTime;
        }
      });
    });
    
    // Format dates
    const oldestDate = allPageViews.length > 0 ? new Date(oldestTimestamp).toISOString().split('T')[0] : null;
    const newestDate = allPageViews.length > 0 ? new Date(newestTimestamp).toISOString().split('T')[0] : null;
    
    // Estimate storage size (rough approximation)
    // Average size per page view: ~500 bytes + ~100 bytes per session
    const estimatedSizeBytes = allPageViews.length * 500 + totalSessions * 100;
    
    return {
      totalEntries: allPageViews.length,
      totalSessions,
      oldestDate,
      newestDate,
      estimatedSizeBytes,
      entriesByDomain
    };
  } catch (error) {
    console.error('Error calculating page view storage usage:', error);
    return {
      totalEntries: 0,
      totalSessions: 0,
      oldestDate: null,
      newestDate: null,
      estimatedSizeBytes: 0,
      entriesByDomain: {}
    };
  }
}

/**
 * Optimize page view storage by compressing old sessions
 * This function reduces storage usage by merging sessions older than the specified threshold
 * 
 * @param thresholdDays - Age threshold in days for compressing sessions
 * @returns Promise resolving when optimization is complete
 */
export async function optimizePageViewStorage(thresholdDays: number = 7): Promise<void> {
  try {
    console.log(`Optimizing page view storage for data older than ${thresholdDays} days...`);
    
    // Calculate the threshold timestamp
    const now = Date.now();
    const thresholdTimestamp = now - thresholdDays * 24 * 60 * 60 * 1000;
    
    // Get all page views
    const allPageViews = await getAllPageViews();
    let optimizationCount = 0;
    
    // Process each page view
    const optimizedPageViews = allPageViews.map(pageView => {
      // Separate recent and old sessions
      const recentSessions = pageView.sessions.filter(session => 
        session.startTime >= thresholdTimestamp
      );
      
      const oldSessions = pageView.sessions.filter(session => 
        session.startTime < thresholdTimestamp
      );
      
      // If there are no old sessions, no optimization needed
      if (oldSessions.length <= 1) {
        return pageView;
      }
      
      // Group old sessions by day
      const sessionsByDay: Record<string, PageViewSession[]> = {};
      
      oldSessions.forEach(session => {
        const date = new Date(session.startTime);
        const dateString = date.toISOString().split('T')[0];
        
        if (!sessionsByDay[dateString]) {
          sessionsByDay[dateString] = [];
        }
        
        sessionsByDay[dateString].push(session);
      });
      
      // Merge sessions for each day into a single session
      const mergedOldSessions: PageViewSession[] = [];
      
      Object.entries(sessionsByDay).forEach(([dateString, sessions]) => {
        // Find the earliest start time and latest end time
        const startTime = Math.min(...sessions.map(s => s.startTime));
        const endTime = Math.max(...sessions.map(s => s.endTime));
        
        // Create a merged session
        mergedOldSessions.push({
          startTime,
          endTime,
          active: sessions.some(s => s.active)
        });
        
        // Count the optimization
        optimizationCount += sessions.length - 1;
      });
      
      // Combine recent and merged old sessions
      return {
        ...pageView,
        sessions: [...mergedOldSessions, ...recentSessions],
        totalDuration: calculateTotalDuration([...mergedOldSessions, ...recentSessions])
      };
    });
    
    // Save the optimized page views
    await saveData(STORAGE_KEYS.pageViews, optimizedPageViews);
    
    // Update date-based storage
    await organizePageViewsByDate();
    
    console.log(`Page view storage optimization complete. Merged ${optimizationCount} sessions.`);
  } catch (error) {
    console.error('Error optimizing page view storage:', error);
  }
}

/**
 * Export page view data to a downloadable format
 * This function prepares page view data for export
 * 
 * @param format - Export format ('json' or 'csv')
 * @param startDate - Optional start date for filtering
 * @param endDate - Optional end date for filtering
 * @returns Promise resolving to export data
 */
export async function exportPageViewData(
  format: 'json' | 'csv' = 'json',
  startDate?: Date,
  endDate?: Date
): Promise<string> {
  try {
    // Get page views, filtered by date range if specified
    let pageViews: PageView[];
    
    if (startDate && endDate) {
      pageViews = await getPageViewsByDateRange(startDate, endDate);
    } else {
      pageViews = await getAllPageViews();
    }
    
    if (format === 'json') {
      // Return JSON format
      return JSON.stringify(pageViews, null, 2);
    } else if (format === 'csv') {
      // Create CSV format
      const csvRows: string[] = [];
      
      // Add header row
      csvRows.push('URL,Title,Domain,First Visited,Last Visited,Total Duration (seconds),Sessions');
      
      // Add data rows
      pageViews.forEach(pageView => {
        const firstVisited = new Date(pageView.firstVisited).toISOString();
        const lastVisited = new Date(pageView.lastVisited).toISOString();
        
        // Create session summary
        const sessionSummary = pageView.sessions.map(session => {
          const start = new Date(session.startTime).toISOString();
          const end = new Date(session.endTime).toISOString();
          const duration = (session.endTime - session.startTime) / 1000;
          return `${start}-${end}(${duration.toFixed(1)}s)`;
        }).join(';');
        
        // Escape fields for CSV
        const escapeCsv = (field: string) => `"${field.replace(/"/g, '""')}"`;
        
        csvRows.push([
          escapeCsv(pageView.url),
          escapeCsv(pageView.pageTitle || ''),
          escapeCsv(pageView.hostname),
          firstVisited,
          lastVisited,
          pageView.totalDuration.toFixed(1),
          escapeCsv(sessionSummary)
        ].join(','));
      });
      
      return csvRows.join('\n');
    }
    
    throw new Error(`Unsupported export format: ${format}`);
  } catch (error) {
    console.error('Error exporting page view data:', error);
    return '';
  }
}