import { defineBackground } from "wxt/sandbox";
import { getTodayStats, getWeekStats } from "@/lib/history-analyzer";
import { 
  saveData, 
  STORAGE_KEYS, 
  savePageViewSession, 
  loadData 
} from "@/lib/storage-manager";
import { 
  PageViewMessageType, 
  PageViewMessage, 
  PageActivatedData, 
  PageDeactivatedData, 
  SessionUpdateData,
  SettingsRequestData,
  SettingsResponseData,
  UserSettings
} from "@/lib/types";

// Define a custom message type for settings updates
interface SettingsUpdatedMessage {
  type: 'settings_updated';
  data: {
    settings: UserSettings;
  };
}

const ALARM_NAME = "update-stats-alarm";

// Default user settings
const DEFAULT_USER_SETTINGS: UserSettings = {
  collectData: true,
  collectionFrequency: "daily",
  excludeIncognito: true,
  excludedDomains: [],
  trackPageViewDuration: true,
  inactivityThresholdMinutes: 5,
  pauseOnInactivity: true,
  pageViewStorageDays: 30
};

// Active page sessions map to track currently active pages by tabId
const activePageSessions = new Map<number, {
  url: string;
  normalizedUrl: string;
  startTime: number;
  pageTitle?: string;
  faviconUrl?: string;
}>();

async function updateStats() {
  console.log("Updating stats...");
  try {
    const todayStats = await getTodayStats();
    await saveData(STORAGE_KEYS.todayStats, todayStats);

    const weekStats = await getWeekStats();
    await saveData(STORAGE_KEYS.weekStats, weekStats);
    
    // Update time tracking statistics
    await updateTimeTrackingStats();
    
    // Run auto-cleanup for page view data
    const { autoCleanupPageViewData } = await import('@/lib/storage-manager');
    await autoCleanupPageViewData();

    console.log("Stats updated successfully.");
  } catch (error) {
    console.error("Error updating stats:", error);
  }
}

/**
 * Update time tracking statistics for today and this week
 * This aggregates page view data into time-based statistics
 */
async function updateTimeTrackingStats() {
  try {
    // Import the functions from storage-manager
    const { 
      updateTodayTimeStats, 
      updateWeekTimeStats, 
      updateMonthlyAggregation,
      updateDomainStatistics,
      getAllPageViews,
      recalculatePageViewDuration,
      organizePageViewsByDate // Import the new function
    } = await import('@/lib/storage-manager');
    
    // Update today's time statistics
    await updateTodayTimeStats();
    
    // Update this week's time statistics
    await updateWeekTimeStats();
    
    // Update monthly statistics
    await updateMonthlyAggregation();
    
    // Update domain statistics for all domains
    // This ensures comprehensive domain statistics are maintained
    const allPageViews = await getAllPageViews();
    const uniqueDomains = new Set<string>();
    
    // Collect unique domains
    allPageViews.forEach(pageView => {
      uniqueDomains.add(pageView.hostname);
    });
    
    // Update statistics for each domain
    for (const domain of uniqueDomains) {
      // Find a representative page view for this domain
      const domainPageView = allPageViews.find(pv => pv.hostname === domain);
      if (domainPageView) {
        await updateDomainStatistics(domainPageView);
      }
    }
    
    // Periodically recalculate durations for all page views to ensure accuracy
    // This is especially important after session merging
    const recalculationInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const lastRecalculation = await chrome.storage.local.get('lastDurationRecalculation');
    const now = Date.now();
    
    if (!lastRecalculation.lastDurationRecalculation || 
        now - lastRecalculation.lastDurationRecalculation > recalculationInterval) {
      console.log("Performing periodic recalculation of page view durations...");
      
      // Process page views in batches to avoid performance issues
      const batchSize = 20;
      for (let i = 0; i < allPageViews.length; i += batchSize) {
        const batch = allPageViews.slice(i, i + batchSize);
        for (const pageView of batch) {
          await recalculatePageViewDuration(pageView.normalizedUrl);
        }
      }
      
      // Update the last recalculation timestamp
      await chrome.storage.local.set({ lastDurationRecalculation: now });
      console.log("Page view duration recalculation completed.");
      
      // Organize page views by date for more efficient retrieval
      await organizePageViewsByDate();
    }
    
    console.log("Time tracking stats updated successfully.");
  } catch (error) {
    console.error("Error updating time tracking stats:", error);
  }
}

/**
 * Handle messages from content scripts
 * @param message - The message received
 * @param sender - Information about the sender
 */
async function handleMessage(
  message: PageViewMessage | SettingsUpdatedMessage,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  // Handle settings_updated message which can come from popup or options page
  if (message.type === 'settings_updated') {
    return handleSettingsUpdated(message.data.settings);
  }
  
  const tabId = sender.tab?.id;
  
  if (!tabId) {
    console.warn("Received message from unknown tab");
    return;
  }

  // Get favicon URL from the tab if available
  const faviconUrl = sender.tab?.favIconUrl;

  switch (message.type) {
    case PageViewMessageType.PAGE_ACTIVATED:
      return handlePageActivated(tabId, message.data as PageActivatedData, faviconUrl);
    
    case PageViewMessageType.PAGE_DEACTIVATED:
      return handlePageDeactivated(tabId, message.data as PageDeactivatedData, faviconUrl);
    
    case PageViewMessageType.SESSION_UPDATE:
      return handleSessionUpdate(tabId, message.data as SessionUpdateData, faviconUrl);
    
    case PageViewMessageType.SETTINGS_REQUEST:
      return handleSettingsRequest(message.data as SettingsRequestData);
    
    default:
      console.warn(`Unknown message type: ${message.type}`);
      return;
  }
}

/**
 * Handle PAGE_ACTIVATED event
 * @param tabId - The ID of the tab
 * @param data - The page activated data
 * @param faviconUrl - The favicon URL of the page
 */
async function handlePageActivated(
  tabId: number,
  data: PageActivatedData,
  faviconUrl?: string
): Promise<void> {
  console.log(`Page activated in tab ${tabId}: ${data.url}`);
  
  // Check if there's already an active session for this tab
  const existingSession = activePageSessions.get(tabId);
  
  if (existingSession) {
    // If the URL has changed, end the previous session before starting a new one
    if (existingSession.url !== data.url) {
      const sessionData = {
        startTime: existingSession.startTime,
        endTime: data.timestamp,
        active: true
      };
      
      // Save the previous session
      await savePageViewSession(
        existingSession.url,
        sessionData,
        existingSession.faviconUrl,
        existingSession.pageTitle
      );
      
      console.log(`Ended previous session for ${existingSession.url} (duration: ${
        ((data.timestamp - existingSession.startTime) / 1000).toFixed(2)
      }s)`);
    } else {
      // Same URL, might be a page refresh or a SPA navigation that didn't change the URL
      // We'll just update the start time and keep tracking
      console.log(`Tab ${tabId} reactivated same URL: ${data.url}`);
      
      // If the page was refreshed, we should still record the previous session
      // and start a new one to ensure accurate tracking
      if (data.timestamp - existingSession.startTime > 500) { // More than 500ms indicates likely refresh
        const sessionData = {
          startTime: existingSession.startTime,
          endTime: data.timestamp,
          active: true
        };
        
        // Save the previous session
        await savePageViewSession(
          existingSession.url,
          sessionData,
          existingSession.faviconUrl,
          existingSession.pageTitle
        );
        
        console.log(`Recorded refresh session for ${existingSession.url} (duration: ${
          ((data.timestamp - existingSession.startTime) / 1000).toFixed(2)
        }s)`);
      }
    }
  }
  
  // Get user settings to check if we should track this page
  const settings = await loadData<UserSettings>(
    STORAGE_KEYS.userSettings,
    DEFAULT_USER_SETTINGS
  );
  
  // Check if tracking is disabled or domain is excluded
  const shouldTrack = settings.trackPageViewDuration && 
    !(settings.excludedDomains && 
      settings.excludedDomains.some(domain => data.url.includes(domain)));
  
  if (shouldTrack) {
    // Store the active session information
    activePageSessions.set(tabId, {
      url: data.url,
      normalizedUrl: data.normalizedUrl,
      startTime: data.timestamp,
      pageTitle: data.pageTitle,
      faviconUrl: faviconUrl || existingSession?.faviconUrl
    });
    
    console.log(`Started tracking session for ${data.url} in tab ${tabId}`);
  } else {
    console.log(`Skipping tracking for ${data.url} (tracking disabled or domain excluded)`);
    // Remove any existing session for this tab
    activePageSessions.delete(tabId);
  }
}

/**
 * Handle PAGE_DEACTIVATED event
 * @param tabId - The ID of the tab
 * @param data - The page deactivated data
 * @param faviconUrl - The favicon URL of the page
 */
async function handlePageDeactivated(
  tabId: number,
  data: PageDeactivatedData,
  faviconUrl?: string
): Promise<void> {
  console.log(`Page deactivated in tab ${tabId}: ${data.url}`);
  
  // Get the active session to retrieve the page title and other metadata
  const activeSession = activePageSessions.get(tabId);
  
  // Validate session data
  if (!data.sessionData || data.sessionData.endTime < data.sessionData.startTime) {
    console.warn(`Invalid session data received for tab ${tabId}:`, data.sessionData);
    return;
  }
  
  // Get user settings to check if we should track this page
  const settings = await loadData<UserSettings>(
    STORAGE_KEYS.userSettings,
    DEFAULT_USER_SETTINGS
  );
  
  // Check if tracking is disabled or domain is excluded
  const shouldTrack = settings.trackPageViewDuration && 
    !(settings.excludedDomains && 
      settings.excludedDomains.some(domain => data.url.includes(domain)));
  
  if (!shouldTrack) {
    console.log(`Skipping tracking for ${data.url} (tracking disabled or domain excluded)`);
    activePageSessions.delete(tabId);
    return;
  }
  
  // Calculate session duration in seconds
  const sessionDuration = (data.sessionData.endTime - data.sessionData.startTime) / 1000;
  
  // Log session details for debugging
  console.log(`Session duration for ${data.url}: ${sessionDuration.toFixed(2)} seconds, active: ${data.sessionData.active}`);
  
  // Only save sessions that have a meaningful duration (more than 0.5 seconds)
  // This helps filter out very short accidental navigations
  if (sessionDuration >= 0.5) {
    // If we have an active session record but the URLs don't match,
    // this might be due to a navigation that wasn't properly captured
    // We should use the metadata from our active session record if available
    const pageTitle = activeSession?.pageTitle || document.title;
    const pageFaviconUrl = faviconUrl || activeSession?.faviconUrl;
    
    // Save the complete session with all available metadata
    // The savePageViewSession function handles session merging and duration calculation
    await savePageViewSession(
      data.url,
      data.sessionData,
      pageFaviconUrl,
      pageTitle
    );
    
    console.log(`Saved complete session for ${data.url} (${sessionDuration.toFixed(2)}s, active: ${data.sessionData.active})`);
  } else {
    console.log(`Skipping very short session (${sessionDuration.toFixed(2)}s) for ${data.url}`);
  }
  
  // Remove the active session from our tracking map
  activePageSessions.delete(tabId);
}

/**
 * Handle SESSION_UPDATE event (partial sessions)
 * @param tabId - The ID of the tab
 * @param data - The session update data
 * @param faviconUrl - The favicon URL of the page
 */
async function handleSessionUpdate(
  tabId: number,
  data: SessionUpdateData,
  faviconUrl?: string
): Promise<void> {
  console.log(`Session update in tab ${tabId}: ${data.url}`);
  
  // Get the active session to retrieve the page title and other metadata
  const activeSession = activePageSessions.get(tabId);
  
  // Validate session data
  if (!data.sessionData || data.sessionData.endTime < data.sessionData.startTime) {
    console.warn(`Invalid session data received for tab ${tabId}:`, data.sessionData);
    return;
  }
  
  // Get user settings to check if we should track this page
  const settings = await loadData<UserSettings>(
    STORAGE_KEYS.userSettings,
    DEFAULT_USER_SETTINGS
  );
  
  // Check if tracking is disabled or domain is excluded
  const shouldTrack = settings.trackPageViewDuration && 
    !(settings.excludedDomains && 
      settings.excludedDomains.some(domain => data.url.includes(domain)));
  
  if (!shouldTrack) {
    console.log(`Skipping tracking for ${data.url} (tracking disabled or domain excluded)`);
    return;
  }
  
  // Calculate session duration in seconds
  const sessionDuration = (data.sessionData.endTime - data.sessionData.startTime) / 1000;
  
  // Log session details for debugging
  console.log(`Partial session update for ${data.url}: ${sessionDuration.toFixed(2)} seconds, active: ${data.sessionData.active}`);
  
  // Only save sessions that have a meaningful duration (more than 0.5 seconds)
  if (sessionDuration >= 0.5) {
    // If we have an active session record but the URLs don't match,
    // this might be due to a navigation that wasn't properly captured
    const pageTitle = activeSession?.pageTitle;
    const pageFaviconUrl = faviconUrl || activeSession?.faviconUrl;
    
    // Save the partial session with all available metadata
    // The savePageViewSession function handles session merging and duration calculation
    await savePageViewSession(
      data.url,
      data.sessionData,
      pageFaviconUrl,
      pageTitle
    );
    
    console.log(`Saved partial session for ${data.url} (${sessionDuration.toFixed(2)}s, active: ${data.sessionData.active})`);
    
    // Update the active session start time to the end time of this partial session
    // This ensures we continue tracking from where we left off
    if (activeSession && activeSession.url === data.url) {
      activeSession.startTime = data.sessionData.endTime;
      console.log(`Updated active session start time for ${data.url} to ${new Date(data.sessionData.endTime).toISOString()}`);
    } else if (activeSession && activeSession.url !== data.url) {
      // This is an unusual case where the active session URL doesn't match the update
      // This could happen if there was a race condition or missed navigation event
      console.warn(`Session update URL (${data.url}) doesn't match active session URL (${activeSession.url})`);
      
      // We'll update the active session to match the current URL to maintain consistency
      activePageSessions.set(tabId, {
        url: data.url,
        normalizedUrl: data.normalizedUrl,
        startTime: data.sessionData.endTime,
        pageTitle: pageTitle || activeSession.pageTitle,
        faviconUrl: pageFaviconUrl
      });
      
      console.log(`Corrected active session for tab ${tabId} to ${data.url}`);
    } else if (!activeSession) {
      // If there's no active session for this tab, create one
      // This can happen if the background script was restarted or if there was a messaging issue
      activePageSessions.set(tabId, {
        url: data.url,
        normalizedUrl: data.normalizedUrl,
        startTime: data.sessionData.endTime,
        pageTitle: pageTitle,
        faviconUrl: pageFaviconUrl
      });
      
      console.log(`Created new active session for tab ${tabId} with URL ${data.url}`);
    }
  } else {
    console.log(`Skipping very short partial session (${sessionDuration.toFixed(2)}s) for ${data.url}`);
  }
}

/**
 * Handle SETTINGS_REQUEST event
 * @param data - The settings request data
 */
async function handleSettingsRequest(
  data: SettingsRequestData
): Promise<SettingsResponseData> {
  // Load user settings or use defaults
  const settings = await loadData<UserSettings>(
    STORAGE_KEYS.userSettings,
    DEFAULT_USER_SETTINGS
  );
  
  return {
    settings
  };
}

/**
 * Handle SETTINGS_UPDATED event
 * @param settings - The updated user settings
 */
async function handleSettingsUpdated(
  settings: UserSettings
): Promise<void> {
  console.log('Settings updated, propagating to all tabs');
  
  // Save the updated settings
  await saveData(STORAGE_KEYS.userSettings, settings);
  
  // Get all tabs to notify them about the settings update
  const tabs = await browser.tabs.query({});
  
  // Send the updated settings to all tabs
  for (const tab of tabs) {
    if (tab.id) {
      try {
        await browser.tabs.sendMessage(tab.id, {
          type: PageViewMessageType.SETTINGS_RESPONSE,
          data: { settings }
        });
        console.log(`Updated settings sent to tab ${tab.id}`);
      } catch (error) {
        // This error is expected for tabs where content script is not running
        // No need to log it as it would create noise in the console
      }
    }
  }
  
  return;
}

export default defineBackground({
  main() {
    // 扩展安装或浏览器启动时立即运行
    chrome.runtime.onStartup.addListener(updateStats);
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install" || details.reason === "update") {
        updateStats();
      }
    });

    // 创建一个定时器，定期更新数据
    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: 15, // 每 15 分钟更新一次
      delayInMinutes: 1, // 1 分钟后第一次执行
    });

    // 监听定时器
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARM_NAME) {
        updateStats();
      }
    });

    // Set up message listener for page view events
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Handle the message asynchronously
      handleMessage(message, sender)
        .then(response => {
          if (response) {
            sendResponse(response);
          }
        })
        .catch(error => {
          console.error("Error handling message:", error);
          sendResponse({ error: error.message });
        });
      
      // Return true to indicate we will respond asynchronously
      return true;
    });

    // Handle tab removal to ensure we save any active sessions
    chrome.tabs.onRemoved.addListener((tabId) => {
      const activeSession = activePageSessions.get(tabId);
      if (activeSession) {
        const sessionData = {
          startTime: activeSession.startTime,
          endTime: Date.now(),
          active: true
        };
        
        savePageViewSession(
          activeSession.url,
          sessionData,
          activeSession.faviconUrl,
          activeSession.pageTitle
        ).catch(error => {
          console.error(`Error saving session for closed tab ${tabId}:`, error);
        });
        
        activePageSessions.delete(tabId);
      }
    });

    // 为了确保弹窗能立即响应，在 main 函数第一次执行时也更新一次
    updateStats();
  },
});