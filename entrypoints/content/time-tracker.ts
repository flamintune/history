import { browser } from 'wxt/browser';
import { 
  PageViewSession, 
  PageViewMessageType,
  PageActivatedData,
  PageDeactivatedData
} from '../../lib/types';

/**
 * TimeTracker class responsible for tracking time spent on web pages
 * Handles session management, visibility changes, and focus events
 */
export class TimeTracker {
  private sessionStartTime: number | null = null;
  private currentUrl: string;
  private currentNormalizedUrl: string;
  private currentHostname: string;
  private isActive: boolean = true;
  private lastActivityTime: number = Date.now();
  private inactivityTimeout: number | null = null;
  private inactivityThreshold: number = 5 * 60 * 1000; // Default 5 minutes in milliseconds
  private excludedDomains: string[] = []; // List of domains to exclude from tracking

  constructor() {
    this.currentUrl = window.location.href;
    this.currentNormalizedUrl = this.normalizeUrl(this.currentUrl);
    this.currentHostname = new URL(this.currentUrl).hostname;
    
    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up all necessary event listeners with throttling for performance
   */
  private setupEventListeners(): void {
    // Visibility change events - no throttling needed as these are infrequent
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    
    // Page unload event - no throttling needed as this is a one-time event
    window.addEventListener('beforeunload', this.endSession.bind(this));
    
    // Focus and blur events - no throttling needed as these are infrequent
    window.addEventListener('focus', this.handleFocus.bind(this));
    window.addEventListener('blur', this.handleBlur.bind(this));
    
    // User activity events - apply heavy throttling as these fire frequently
    // Use passive option for better performance
    document.addEventListener('mousemove', this.throttle(this.handleUserActivity.bind(this), 500), { passive: true });
    document.addEventListener('keydown', this.throttle(this.handleUserActivity.bind(this), 250), { passive: true });
    document.addEventListener('click', this.throttle(this.handleUserActivity.bind(this), 100), { passive: true });
    document.addEventListener('scroll', this.throttle(this.handleUserActivity.bind(this), 500), { passive: true });
    
    // Use intersection observer for visibility detection instead of scroll events when possible
    if ('IntersectionObserver' in window) {
      this.setupIntersectionObserver();
    }
  }

  /**
   * Set up intersection observer to efficiently track visibility
   * This is more performant than scroll events
   */
  private setupIntersectionObserver(): void {
    // Create an observer that fires when the page visibility changes
    const observer = new IntersectionObserver(
      (entries) => {
        // We're only observing one element (the body)
        const isVisible = entries[0]?.isIntersecting;
        if (isVisible) {
          this.resumeSession();
        } else {
          this.pauseSession();
        }
      },
      {
        threshold: 0.1 // Fire when at least 10% of the element is visible
      }
    );
    
    // Start observing the document body
    observer.observe(document.body);
  }

  /**
   * Throttle function to limit how often a function can be called
   * 
   * @param func - Function to throttle
   * @param limit - Minimum time between function calls in milliseconds
   * @returns Throttled function
   */
  private throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= limit) {
        lastCall = now;
        func(...args);
      }
    };
  }

  /**
   * Start a new tracking session
   */
  public startSession(): void {
    // Check if the current domain is excluded before starting a session
    if (this.isDomainExcluded()) {
      console.log(`Domain ${this.currentHostname} is excluded from tracking`);
      return;
    }
    
    if (this.sessionStartTime === null) {
      this.sessionStartTime = Date.now();
      this.lastActivityTime = Date.now();
      this.isActive = true;
      
      // Send message to background script
      browser.runtime.sendMessage({
        type: PageViewMessageType.PAGE_ACTIVATED,
        data: {
          url: this.currentUrl,
          normalizedUrl: this.currentNormalizedUrl,
          hostname: this.currentHostname,
          pageTitle: document.title,
          timestamp: this.sessionStartTime,
          faviconUrl: this.findFavicon() // Include favicon URL if found
        } as PageActivatedData
      });
    }
  }

  /**
   * Pause the current tracking session
   */
  public pauseSession(): void {
    if (this.sessionStartTime !== null) {
      const sessionEndTime = Date.now();
      const sessionData: PageViewSession = {
        startTime: this.sessionStartTime,
        endTime: sessionEndTime,
        active: this.isActive
      };
      
      // Send partial session data to background script
      browser.runtime.sendMessage({
        type: PageViewMessageType.SESSION_UPDATE,
        data: {
          url: this.currentUrl,
          normalizedUrl: this.currentNormalizedUrl,
          sessionData
        }
      });
      
      this.sessionStartTime = null;
    }
  }

  /**
   * Resume a previously paused tracking session
   */
  public resumeSession(): void {
    this.startSession();
  }

  /**
   * End the current tracking session
   */
  public endSession(): void {
    if (this.sessionStartTime !== null) {
      const sessionEndTime = Date.now();
      const sessionData: PageViewSession = {
        startTime: this.sessionStartTime,
        endTime: sessionEndTime,
        active: this.isActive
      };
      
      // Send complete session data to background script
      browser.runtime.sendMessage({
        type: PageViewMessageType.PAGE_DEACTIVATED,
        data: {
          url: this.currentUrl,
          normalizedUrl: this.currentNormalizedUrl,
          sessionData
        } as PageDeactivatedData
      });
      
      this.sessionStartTime = null;
    }
  }

  /**
   * Handle visibility change events
   */
  public handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.resumeSession();
    } else {
      this.pauseSession();
    }
  }

  /**
   * Handle window focus events
   */
  private handleFocus(): void {
    this.resumeSession();
  }

  /**
   * Handle window blur events
   */
  private handleBlur(): void {
    this.pauseSession();
  }

  /**
   * Handle user activity events to track inactivity
   * Optimized with throttling and requestAnimationFrame for better performance
   */
  private handleUserActivity(): void {
    // Use requestAnimationFrame to batch activity updates during the next paint cycle
    // This prevents multiple redundant updates in the same frame
    if (!this._pendingActivityUpdate) {
      this._pendingActivityUpdate = true;
      
      requestAnimationFrame(() => {
        const now = Date.now();
        this._pendingActivityUpdate = false;
        
        // Update the last activity time
        this.lastActivityTime = now;
        
        // If we were inactive before, mark as active again
        if (!this.isActive) {
          this.isActive = true;
          
          // If we have an ongoing session, end it and start a new one
          // This separates inactive time from active time
          if (this.sessionStartTime !== null) {
            this.endSession();
            this.startSession();
          }
        }
        
        // Clear any existing inactivity timeout
        if (this.inactivityTimeout !== null) {
          window.clearTimeout(this.inactivityTimeout);
          this.inactivityTimeout = null;
        }
        
        // Set a new inactivity timeout
        this.inactivityTimeout = window.setTimeout(() => {
          this.handleInactivity();
        }, this.inactivityThreshold);
      });
    }
  }
  
  // Flag to track pending activity updates
  private _pendingActivityUpdate: boolean = false;

  /**
   * Handle user inactivity
   */
  private handleInactivity(): void {
    this.isActive = false;
    
    // End the current session and mark it as inactive
    if (this.sessionStartTime !== null) {
      this.endSession();
    }
  }

  /**
   * Set the inactivity threshold
   * @param minutes - Inactivity threshold in minutes
   */
  public setInactivityThreshold(minutes: number): void {
    this.inactivityThreshold = minutes * 60 * 1000;
  }
  
  /**
   * Enable or disable inactivity detection
   * @param enabled - Whether inactivity detection should be enabled
   */
  public setInactivityDetection(enabled: boolean): void {
    if (!enabled) {
      // Clear any existing inactivity timeout
      if (this.inactivityTimeout !== null) {
        window.clearTimeout(this.inactivityTimeout);
        this.inactivityTimeout = null;
      }
      
      // Always consider the user active when inactivity detection is disabled
      this.isActive = true;
    } else {
      // Reset the activity timer when enabling inactivity detection
      this.lastActivityTime = Date.now();
      this.handleUserActivity();
    }
  }
  
  /**
   * Check if the user is currently active
   * @returns Boolean indicating if the user is active
   */
  public isUserActive(): boolean {
    return this.isActive;
  }
  
  /**
   * Get the time elapsed since the last user activity
   * @returns Time in milliseconds since last activity
   */
  public getTimeSinceLastActivity(): number {
    return Date.now() - this.lastActivityTime;
  }
  
  /**
   * Detect if the user has been inactive for longer than the threshold
   * @returns Boolean indicating if the user is considered inactive
   */
  public detectInactivity(): boolean {
    const timeSinceLastActivity = this.getTimeSinceLastActivity();
    return timeSinceLastActivity > this.inactivityThreshold;
  }

  /**
   * Advanced URL normalization with caching for performance
   * - Removes query parameters (configurable)
   * - Handles hash-based routes for SPAs
   * - Normalizes trailing slashes
   * - Handles common URL variations
   * 
   * @param url - URL to normalize
   * @param keepQueryParams - Optional array of query params to keep
   * @param keepHash - Whether to keep the hash part (useful for SPA routing)
   * @returns Normalized URL
   */
  private normalizeUrl(url: string, keepQueryParams: string[] = [], keepHash: boolean = false): string {
    // Generate a cache key based on the parameters
    const cacheKey = `${url}|${keepQueryParams.join(',')}|${keepHash}`;
    
    // Check if we have a cached result
    if (this._urlNormalizationCache[cacheKey]) {
      return this._urlNormalizationCache[cacheKey];
    }
    
    try {
      // Parse the URL
      const urlObj = new URL(url);
      
      // Build the base normalized URL (protocol + hostname + port)
      let normalizedUrl = urlObj.origin;
      
      // Add the pathname, ensuring consistent trailing slash handling
      // Remove trailing slash except for root path
      if (urlObj.pathname === '/') {
        normalizedUrl += '/';
      } else {
        normalizedUrl += urlObj.pathname.replace(/\/$/, '');
      }
      
      // Handle query parameters if specified
      if (keepQueryParams.length > 0 && urlObj.search) {
        const searchParams = new URLSearchParams(urlObj.search);
        const filteredParams = new URLSearchParams();
        
        // Only keep the specified query parameters
        for (const param of keepQueryParams) {
          if (searchParams.has(param)) {
            filteredParams.set(param, searchParams.get(param)!);
          }
        }
        
        // Add filtered query parameters to the normalized URL
        const filteredSearch = filteredParams.toString();
        if (filteredSearch) {
          normalizedUrl += '?' + filteredSearch;
        }
      }
      
      // Handle hash if specified (important for SPA routing)
      if (keepHash && urlObj.hash) {
        normalizedUrl += urlObj.hash;
      }
      
      // Cache the result
      this._urlNormalizationCache[cacheKey] = normalizedUrl;
      
      // Limit cache size to prevent memory leaks
      const cacheKeys = Object.keys(this._urlNormalizationCache);
      if (cacheKeys.length > 100) {
        // Remove the oldest entry
        delete this._urlNormalizationCache[cacheKeys[0]];
      }
      
      return normalizedUrl;
    } catch (e) {
      // If URL parsing fails, return the original URL
      console.error('URL normalization failed:', e);
      return url;
    }
  }
  
  // Cache for URL normalization results
  private _urlNormalizationCache: Record<string, string> = {};
  
  /**
   * Detect if the URL has changed significantly enough to be considered a new page
   * This is especially important for SPAs where the URL might change without a full page reload
   * Optimized with caching for better performance
   * 
   * @param oldUrl - Previous URL
   * @param newUrl - Current URL
   * @returns Boolean indicating if the page should be considered changed
   */
  public hasUrlChangedSignificantly(oldUrl: string, newUrl: string): boolean {
    // Quick equality check first to avoid unnecessary processing
    if (oldUrl === newUrl) {
      return false;
    }
    
    // Generate a cache key for this comparison
    const cacheKey = `${oldUrl}|${newUrl}`;
    
    // Check if we have a cached result
    if (this._urlComparisonCache[cacheKey] !== undefined) {
      return this._urlComparisonCache[cacheKey];
    }
    
    try {
      // Optimize URL parsing by reusing URL objects when possible
      const oldUrlObj = this._getUrlObject(oldUrl);
      const newUrlObj = this._getUrlObject(newUrl);
      
      let result = false;
      
      // Different domains are always considered different pages
      if (oldUrlObj.hostname !== newUrlObj.hostname) {
        result = true;
      }
      // Different pathnames are considered different pages
      else if (oldUrlObj.pathname !== newUrlObj.pathname) {
        result = true;
      }
      // For SPAs, check if the hash part represents a route change
      else if (oldUrlObj.hash !== newUrlObj.hash) {
        // Only consider hash changes that look like routes
        // Simple anchors like #section1 are not considered page changes
        // Use a pre-compiled regex for better performance
        if (this._routeHashRegex.test(newUrlObj.hash)) {
          result = true;
        }
      }
      
      // Cache the result
      this._urlComparisonCache[cacheKey] = result;
      
      // Limit cache size to prevent memory leaks
      const cacheKeys = Object.keys(this._urlComparisonCache);
      if (cacheKeys.length > 100) {
        // Remove the oldest entry
        delete this._urlComparisonCache[cacheKeys[0]];
      }
      
      return result;
    } catch (e) {
      // If URL parsing fails, assume the URLs are different
      console.error('URL comparison failed:', e);
      return true;
    }
  }
  
  // Pre-compiled regex for route hash detection
  private _routeHashRegex = /^#[/!]/;
  
  // Cache for URL comparison results
  private _urlComparisonCache: Record<string, boolean> = {};
  
  // Cache for URL objects to avoid repeated parsing
  private _urlObjectCache: Record<string, URL> = {};
  
  /**
   * Get a URL object from cache or create a new one
   * 
   * @param url - URL string to parse
   * @returns URL object
   */
  private _getUrlObject(url: string): URL {
    if (!this._urlObjectCache[url]) {
      this._urlObjectCache[url] = new URL(url);
      
      // Limit cache size
      const cacheKeys = Object.keys(this._urlObjectCache);
      if (cacheKeys.length > 50) {
        delete this._urlObjectCache[cacheKeys[0]];
      }
    }
    
    return this._urlObjectCache[url];
  }
  
  /**
   * Update the current URL and check if it represents a significant change
   * 
   * @param newUrl - The new URL to check
   * @returns Boolean indicating if the URL has changed significantly
   */
  public updateUrl(newUrl: string): boolean {
    const oldUrl = this.currentUrl;
    const hasChanged = this.hasUrlChangedSignificantly(oldUrl, newUrl);
    
    if (hasChanged) {
      this.currentUrl = newUrl;
      this.currentNormalizedUrl = this.normalizeUrl(newUrl);
      this.currentHostname = new URL(newUrl).hostname;
    }
    
    return hasChanged;
  }

  /**
   * Find the favicon URL for the current page
   * Optimized to minimize DOM operations and use a cached result
   * @returns Favicon URL or undefined
   */
  private findFavicon(): string | undefined {
    // Use cached favicon if available
    if (this._cachedFaviconUrl) {
      return this._cachedFaviconUrl;
    }
    
    // Try to find the favicon in the most efficient way
    // First check for apple-touch-icon which is often higher quality
    let favicon = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']") || 
                 document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon-precomposed']");
    
    // If not found, look for standard favicon
    if (!favicon || !favicon.href) {
      favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']") || 
               document.querySelector<HTMLLinkElement>("link[rel='shortcut icon']");
    }
    
    // If still not found, try a more general but slower query
    if (!favicon || !favicon.href) {
      favicon = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    }
    
    // Cache the result to avoid future DOM operations
    this._cachedFaviconUrl = favicon?.href;
    return this._cachedFaviconUrl;
  }
  
  // Cached favicon URL
  private _cachedFaviconUrl: string | undefined;

  /**
   * Set the list of domains to exclude from tracking
   * @param domains - Array of domain names to exclude
   */
  public setExcludedDomains(domains: string[]): void {
    this.excludedDomains = domains;
    
    // If the current domain is now excluded, end any active session
    if (this.isDomainExcluded()) {
      this.endSession();
    }
  }

  /**
   * Check if the current domain is in the excluded domains list
   * @returns Boolean indicating if the current domain should be excluded from tracking
   */
  public isDomainExcluded(): boolean {
    if (!this.excludedDomains || this.excludedDomains.length === 0) {
      return false;
    }
    
    // Check if any excluded domain is part of the current hostname
    return this.excludedDomains.some(domain => 
      this.currentHostname === domain || 
      this.currentHostname.endsWith(`.${domain}`) || 
      this.currentHostname.includes(domain)
    );
  }

  /**
   * Check if tracking should be enabled for the current page
   * @returns Boolean indicating if tracking should be enabled
   */
  public shouldTrack(): boolean {
    return !this.isDomainExcluded();
  }
}