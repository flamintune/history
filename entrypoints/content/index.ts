import { browser } from 'wxt/browser';
import { TimeTracker } from './time-tracker';
import { PageViewMessageType, UserSettings } from '../../lib/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // Initialize the TimeTracker
    const timeTracker = new TimeTracker();
    
    // Track whether tracking is enabled to avoid unnecessary operations
    let trackingEnabled = true;
    
    // Use a debounced URL change handler for better performance
    let urlChangeTimeout: number | null = null;
    const handleUrlChange = () => {
      // Clear any pending timeout to avoid multiple rapid calls
      if (urlChangeTimeout !== null) {
        window.clearTimeout(urlChangeTimeout);
      }
      
      // Debounce URL change handling to avoid excessive processing during rapid navigation
      urlChangeTimeout = window.setTimeout(() => {
        // Skip if tracking is disabled
        if (!trackingEnabled) return;
        
        const newUrl = window.location.href;
        
        // Check if the URL has changed significantly enough to be considered a new page
        if (timeTracker.updateUrl(newUrl)) {
          // End the current session and start a new one
          timeTracker.endSession();
          timeTracker.startSession();
        }
        
        urlChangeTimeout = null;
      }, 50); // Short delay to batch rapid changes
    };

    // Monitor SPA route changes with passive event listeners for better performance
    window.addEventListener('popstate', handleUrlChange, { passive: true });
    window.addEventListener('hashchange', handleUrlChange, { passive: true });

    // Enhanced history API monitoring for SPA navigation
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      // Use requestAnimationFrame instead of setTimeout for better performance
      requestAnimationFrame(handleUrlChange);
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      // Use requestAnimationFrame instead of setTimeout for better performance
      requestAnimationFrame(handleUrlChange);
    };

    // Set up a mutation observer to detect SPA changes that don't use history API
    // Use a more targeted approach to reduce CPU usage
    let mutationDebounceTimeout: number | null = null;
    const observer = new MutationObserver((mutations) => {
      // Skip if tracking is disabled
      if (!trackingEnabled) return;
      
      // Debounce to avoid excessive processing during rapid DOM changes
      if (mutationDebounceTimeout === null) {
        mutationDebounceTimeout = window.setTimeout(() => {
          // Check if the title has changed, which often indicates a page change in SPAs
          const titleChanged = mutations.some(mutation => 
            mutation.target.nodeName === 'TITLE'
          );
          
          // More efficient check for significant DOM changes
          let significantDomChanges = false;
          
          // Only process a limited number of mutations to avoid performance issues
          const maxMutationsToProcess = Math.min(mutations.length, 20);
          for (let i = 0; i < maxMutationsToProcess; i++) {
            const mutation = mutations[i];
            if (mutation.addedNodes.length > 5 || mutation.removedNodes.length > 5) {
              significantDomChanges = true;
              break;
            }
          }
          
          if (titleChanged || significantDomChanges) {
            handleUrlChange();
          }
          
          mutationDebounceTimeout = null;
        }, 100);
      }
    });
    
    // Start observing the document with optimized parameters
    // Only observe the body and head to reduce the number of mutations
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });

    // Start session if page is visible on load
    if (document.visibilityState === 'visible') {
      timeTracker.startSession();
    }
    
    // Use requestIdleCallback for inactivity checks when available
    // This ensures we don't impact page performance
    let inactivityCheckInterval: number;
    
    const setupInactivityCheck = () => {
      if ('requestIdleCallback' in window) {
        const checkInactivity = () => {
          if (!trackingEnabled) return;
          
          if (timeTracker.detectInactivity()) {
            console.debug('User inactive for threshold period');
          }
          
          // Schedule next check during idle time
          requestIdleCallback(() => {
            window.setTimeout(checkInactivity, 30000);
          });
        };
        
        // Initial check after a delay
        requestIdleCallback(() => {
          window.setTimeout(checkInactivity, 30000);
        });
      } else {
        // Fallback to setInterval for browsers that don't support requestIdleCallback
        inactivityCheckInterval = window.setInterval(() => {
          if (!trackingEnabled) return;
          
          if (timeTracker.detectInactivity()) {
            console.debug('User inactive for threshold period');
          }
        }, 30000); // Check every 30 seconds
      }
    };
    
    setupInactivityCheck();
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      if (inactivityCheckInterval) {
        clearInterval(inactivityCheckInterval);
      }
      
      if (mutationDebounceTimeout !== null) {
        clearTimeout(mutationDebounceTimeout);
      }
      
      if (urlChangeTimeout !== null) {
        clearTimeout(urlChangeTimeout);
      }
      
      observer.disconnect();
    });
    
    // Request user settings from background script
    // Use a timeout to ensure the page loads first
    setTimeout(() => {
      browser.runtime.sendMessage({
        type: PageViewMessageType.SETTINGS_REQUEST,
        data: {}
      }).then(response => {
        // The response should be a SettingsResponseData object with a settings property
        if (response && typeof response === 'object' && 'settings' in response) {
          const settings = response.settings as UserSettings;
          
          // Configure inactivity threshold
          if (settings.inactivityThresholdMinutes) {
            timeTracker.setInactivityThreshold(settings.inactivityThresholdMinutes);
          }
          
          // Enable/disable inactivity detection based on settings
          if (settings.pauseOnInactivity !== undefined) {
            timeTracker.setInactivityDetection(settings.pauseOnInactivity);
          }
          
          // Set excluded domains
          if (settings.excludedDomains && Array.isArray(settings.excludedDomains)) {
            timeTracker.setExcludedDomains(settings.excludedDomains);
            
            // If the current domain is excluded, end any tracking session
            if (timeTracker.isDomainExcluded()) {
              console.log('Current domain is excluded from tracking');
              timeTracker.endSession();
            }
          }
          
          // Check if we should be tracking at all
          if (!settings.trackPageViewDuration) {
            // If tracking is disabled, end any current session and don't start new ones
            timeTracker.endSession();
            trackingEnabled = false;
            
            // Disconnect the observer to save resources
            observer.disconnect();
            
            // Clean up the interval if it exists
            if (inactivityCheckInterval) {
              clearInterval(inactivityCheckInterval);
            }
          }
        }
      }).catch(error => {
        console.error('Error fetching settings:', error);
      });
    }, 100); // Short delay to prioritize page load
  },
});