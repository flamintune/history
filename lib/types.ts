// 额外的类型定义
export interface HistoryStats {
  totalVisits: number;
  uniqueDomains: number;
  topDomains: Array<{ domain: string; visits: number }>;
  hourlyActivity: Record<number, number>;
  dailyActivity: Record<string, number>;
  date?: string;
}

export interface UserSettings {
  collectData: boolean;
  collectionFrequency: "hourly" | "daily";
  excludeIncognito: boolean;
  excludedDomains: string[];
  
  // New fields for page view duration tracking
  trackPageViewDuration: boolean;
  inactivityThresholdMinutes: number;
  pauseOnInactivity: boolean;
  pageViewStorageDays: number; // How many days to keep data
}

export interface PageViewSession {
  startTime: number; // Session start timestamp
  endTime: number;   // Session end timestamp
  active: boolean;   // Whether the user was active during this session
}

// Interface for aggregating all browsing data for a single page
export interface PageView {
  url: string;           // Page URL
  normalizedUrl: string; // Normalized URL (without query params if configured)
  hostname: string;      // Domain hostname
  pageTitle?: string;    // Page title
  faviconUrl?: string;   // Favicon URL
  sessions: PageViewSession[]; // List of browsing sessions
  totalDuration: number; // Total browsing duration (seconds)
  lastVisited: number;   // Timestamp of last visit
  firstVisited: number;  // Timestamp of first visit
}
// Message types for communication between content script and background script
export enum PageViewMessageType {
  PAGE_ACTIVATED = 'page_activated',
  PAGE_DEACTIVATED = 'page_deactivated',
  SESSION_UPDATE = 'session_update',
  SETTINGS_REQUEST = 'settings_request',
  SETTINGS_RESPONSE = 'settings_response'
}

// Interface for page view messages
export interface PageViewMessage {
  type: PageViewMessageType;
  data: PageViewMessageData;
}

// Union type for different message data structures
export type PageViewMessageData = 
  | PageActivatedData
  | PageDeactivatedData
  | SessionUpdateData
  | SettingsRequestData
  | SettingsResponseData;

// Data for when a page is activated (focused)
export interface PageActivatedData {
  url: string;
  normalizedUrl: string;
  hostname: string;
  pageTitle?: string;
  timestamp: number;
  faviconUrl?: string;
}

// Data for when a page is deactivated (unfocused or closed)
export interface PageDeactivatedData {
  url: string;
  normalizedUrl: string;
  sessionData: PageViewSession;
}

// Data for session updates (partial sessions, e.g., during tab switching)
export interface SessionUpdateData {
  url: string;
  normalizedUrl: string;
  sessionData: PageViewSession;
}

// Data for settings request
export interface SettingsRequestData {
  // Empty as it's just a request for settings
}

// Data for settings response
export interface SettingsResponseData {
  settings: UserSettings;
}

// Interface for time tracking statistics
export interface TimeTrackingStats {
  totalTimeToday: number; // Total time spent browsing today (seconds)
  topSites: Array<PageView>; // Top time-consuming sites
  domainDistribution: Record<string, number>; // Time spent per domain
  hourlyDistribution: Record<number, number>; // Time spent per hour of day
}