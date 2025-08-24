import { PageView, TimeTrackingStats } from './types';

/**
 * Interface for chart data point
 */
export interface ChartDataPoint {
  label: string;
  value: number;
}

/**
 * Interface for time distribution data
 */
export interface TimeDistributionData {
  labels: string[];
  values: number[];
  colors?: string[];
  datasets?: {
    label: string;
    data: number[];
    backgroundColor: string | string[];
    borderRadius?: number;
  }[];
}

/**
 * PageViewAnalyzer class for analyzing page view data
 * Provides methods to identify most time-consuming pages and perform
 * domain and time-based aggregations
 */
export class PageViewAnalyzer {
  /**
   * Get the most time-consuming pages
   * 
   * @param pageViews - Array of page views to analyze
   * @param limit - Maximum number of pages to return (default: 10)
   * @returns Array of page views sorted by total duration
   */
  public getMostTimeConsumingPages(pageViews: PageView[], limit: number = 10): PageView[] {
    return [...pageViews]
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, limit);
  }

  /**
   * Get time distribution by domain
   * 
   * @param pageViews - Array of page views to analyze
   * @returns Record mapping domains to total duration in seconds
   */
  public getDomainTimeDistribution(pageViews: PageView[]): Record<string, number> {
    const domainDistribution: Record<string, number> = {};
    
    pageViews.forEach(pageView => {
      const domain = pageView.hostname;
      domainDistribution[domain] = (domainDistribution[domain] || 0) + pageView.totalDuration;
    });
    
    return domainDistribution;
  }

  /**
   * Get the top time-consuming domains
   * 
   * @param pageViews - Array of page views to analyze
   * @param limit - Maximum number of domains to return (default: 10)
   * @returns Array of domain objects sorted by total duration
   */
  public getTopDomains(pageViews: PageView[], limit: number = 10): Array<{ domain: string; duration: number }> {
    const domainDistribution = this.getDomainTimeDistribution(pageViews);
    
    return Object.entries(domainDistribution)
      .map(([domain, duration]) => ({ domain, duration }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get time distribution by hour of day
   * 
   * @param pageViews - Array of page views to analyze
   * @returns Record mapping hours (0-23) to total duration in seconds
   */
  public getTimeByHourOfDay(pageViews: PageView[]): Record<number, number> {
    const hourlyDistribution: Record<number, number> = {};
    
    // Initialize all hours to 0
    for (let i = 0; i < 24; i++) {
      hourlyDistribution[i] = 0;
    }
    
    pageViews.forEach(pageView => {
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
    
    return hourlyDistribution;
  }

  /**
   * Get time distribution by day of week
   * 
   * @param pageViews - Array of page views to analyze
   * @returns Record mapping days (0-6, where 0 is Sunday) to total duration in seconds
   */
  public getTimeByDayOfWeek(pageViews: PageView[]): Record<number, number> {
    const dailyDistribution: Record<number, number> = {};
    
    // Initialize all days to 0
    for (let i = 0; i < 7; i++) {
      dailyDistribution[i] = 0;
    }
    
    pageViews.forEach(pageView => {
      pageView.sessions.forEach(session => {
        // For each session, distribute its time across the days it spans
        let currentTime = session.startTime;
        while (currentTime < session.endTime) {
          const date = new Date(currentTime);
          const day = date.getDay();
          
          // Calculate how much time was spent on this day
          const dayEnd = new Date(date);
          dayEnd.setHours(24, 0, 0, 0);
          
          const timeInDay = Math.min(
            (Math.min(dayEnd.getTime(), session.endTime) - currentTime) / 1000,
            86400 // Cap at one day (24 hours)
          );
          
          dailyDistribution[day] += timeInDay;
          
          // Move to the next day
          currentTime = dayEnd.getTime();
        }
      });
    });
    
    return dailyDistribution;
  }

  /**
   * Filter page views by date range
   * 
   * @param pageViews - Array of page views to filter
   * @param startDate - Start date for filtering
   * @param endDate - End date for filtering
   * @returns Filtered array of page views with sessions in the date range
   */
  public filterPageViewsByDateRange(
    pageViews: PageView[],
    startDate: Date,
    endDate: Date
  ): PageView[] {
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime() + (24 * 60 * 60 * 1000 - 1); // Include the full end date
    
    return pageViews
      .map(pageView => {
        // Filter sessions within the date range
        const filteredSessions = pageView.sessions.filter(session => 
          session.startTime >= startTimestamp && session.startTime <= endTimestamp
        );
        
        if (filteredSessions.length === 0) {
          return null; // No sessions in the date range
        }
        
        // Calculate total duration for filtered sessions
        const totalDuration = filteredSessions.reduce(
          (total, session) => total + ((session.endTime - session.startTime) / 1000),
          0
        );
        
        // Return a new page view object with filtered sessions
        return {
          ...pageView,
          sessions: filteredSessions,
          totalDuration
        };
      })
      .filter((pv): pv is PageView => pv !== null);
  }

  /**
   * Get average session duration
   * 
   * @param pageViews - Array of page views to analyze
   * @returns Average session duration in seconds
   */
  public getAverageSessionDuration(pageViews: PageView[]): number {
    let totalSessions = 0;
    let totalDuration = 0;
    
    pageViews.forEach(pageView => {
      totalSessions += pageView.sessions.length;
      totalDuration += pageView.totalDuration;
    });
    
    return totalSessions > 0 ? totalDuration / totalSessions : 0;
  }

  /**
   * Get time tracking statistics for a set of page views
   * 
   * @param pageViews - Array of page views to analyze
   * @returns Time tracking statistics
   */
  public getTimeTrackingStats(pageViews: PageView[]): TimeTrackingStats {
    const totalTimeToday = pageViews.reduce(
      (total, pageView) => total + pageView.totalDuration,
      0
    );
    
    const topSites = this.getMostTimeConsumingPages(pageViews);
    const domainDistribution = this.getDomainTimeDistribution(pageViews);
    const hourlyDistribution = this.getTimeByHourOfDay(pageViews);
    
    return {
      totalTimeToday,
      topSites,
      domainDistribution,
      hourlyDistribution
    };
  }

  /**
   * Get page views for a specific domain
   * 
   * @param pageViews - Array of page views to filter
   * @param domain - Domain to filter by
   * @returns Filtered array of page views for the specified domain
   */
  public getPageViewsByDomain(pageViews: PageView[], domain: string): PageView[] {
    return pageViews.filter(pageView => pageView.hostname === domain);
  }

  /**
   * Get total browsing time
   * 
   * @param pageViews - Array of page views to analyze
   * @returns Total browsing time in seconds
   */
  public getTotalBrowsingTime(pageViews: PageView[]): number {
    return pageViews.reduce(
      (total, pageView) => total + pageView.totalDuration,
      0
    );
  }

  /**
   * Generate data for domain distribution pie chart
   * 
   * @param pageViews - Array of page views to analyze
   * @param limit - Maximum number of domains to include (others will be grouped)
   * @returns Formatted data for pie chart visualization
   */
  public generateDomainPieChartData(pageViews: PageView[], limit: number = 10): TimeDistributionData {
    const domainDistribution = this.getDomainTimeDistribution(pageViews);
    const totalTime = this.getTotalBrowsingTime(pageViews);
    
    // Sort domains by duration
    const sortedDomains = Object.entries(domainDistribution)
      .map(([domain, duration]) => ({ domain, duration }))
      .sort((a, b) => b.duration - a.duration);
    
    // Take top domains and group the rest as "Other"
    const topDomains = sortedDomains.slice(0, limit);
    const otherDomains = sortedDomains.slice(limit);
    
    const labels: string[] = topDomains.map(item => item.domain);
    const values: number[] = topDomains.map(item => item.duration);
    
    // Add "Other" category if there are more domains
    if (otherDomains.length > 0) {
      const otherDuration = otherDomains.reduce((total, item) => total + item.duration, 0);
      labels.push('Other');
      values.push(otherDuration);
    }
    
    // Generate colors (can be customized by the UI)
    const colors = this.generateChartColors(labels.length);
    
    return { labels, values, colors };
  }

  /**
   * Generate data for hourly distribution bar chart
   * 
   * @param pageViews - Array of page views to analyze
   * @returns Formatted data for hourly distribution visualization
   */
  public generateHourlyBarChartData(pageViews: PageView[]): TimeDistributionData {
    const hourlyDistribution = this.getTimeByHourOfDay(pageViews);
    
    // Format hours for display (e.g., "12 AM", "1 PM")
    const labels = Array.from({ length: 24 }, (_, i) => {
      if (i === 0) return '12 AM';
      if (i < 12) return `${i} AM`;
      if (i === 12) return '12 PM';
      return `${i - 12} PM`;
    });
    
    // Extract values in order
    const values = Array.from({ length: 24 }, (_, i) => hourlyDistribution[i] || 0);
    
    // Generate a gradient color scheme for the hours
    const colors = this.generateGradientColors('#4A90E2', '#F5A623', 24);
    
    return { labels, values, colors };
  }

  /**
   * Generate data for daily distribution bar chart
   * 
   * @param pageViews - Array of page views to analyze
   * @returns Formatted data for daily distribution visualization
   */
  public generateDailyBarChartData(pageViews: PageView[]): TimeDistributionData {
    const dailyDistribution = this.getTimeByDayOfWeek(pageViews);
    
    // Day names
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Extract values in order
    const values = Array.from({ length: 7 }, (_, i) => dailyDistribution[i] || 0);
    
    // Generate colors
    const colors = this.generateChartColors(7);
    
    return { labels: dayNames, values, colors };
  }

  /**
   * Generate data for top sites bar chart
   * 
   * @param pageViews - Array of page views to analyze
   * @param limit - Maximum number of sites to include
   * @returns Formatted data for top sites visualization
   */
  public generateTopSitesChartData(pageViews: PageView[], limit: number = 10): TimeDistributionData {
    const topSites = this.getMostTimeConsumingPages(pageViews, limit);
    
    // Format labels (use page title or hostname if title is not available)
    const labels = topSites.map(site => site.pageTitle || site.hostname);
    
    // Extract duration values
    const values = topSites.map(site => site.totalDuration);
    
    // Generate colors
    const colors = this.generateChartColors(labels.length);
    
    return { labels, values, colors };
  }

  /**
   * Generate data for time trend line chart
   * Shows browsing time trends over days
   * 
   * @param pageViews - Array of page views to analyze
   * @param days - Number of days to include
   * @returns Formatted data for time trend visualization
   */
  public generateTimeTrendChartData(pageViews: PageView[], days: number = 7): TimeDistributionData {
    const today = new Date();
    const labels: string[] = [];
    const values: number[] = [];
    
    // Generate data for each day
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      // Format date label (e.g., "Jul 10")
      const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      labels.push(dateLabel);
      
      // Filter page views for this day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const dayPageViews = this.filterPageViewsByDateRange(pageViews, startOfDay, endOfDay);
      const totalTime = this.getTotalBrowsingTime(dayPageViews);
      
      values.push(totalTime);
    }
    
    return { labels, values };
  }
  
  /**
   * Generate data for domain category distribution chart
   * Groups domains into categories and shows time distribution
   * 
   * @param pageViews - Array of page views to analyze
   * @returns Formatted data for category distribution visualization
   */
  public generateDomainCategoryChartData(pageViews: PageView[]): TimeDistributionData {
    // Define domain categories (simplified example)
    const categories: Record<string, string[]> = {
      'Social Media': ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'reddit.com', 'pinterest.com', 'tiktok.com'],
      'Productivity': ['github.com', 'gitlab.com', 'notion.so', 'trello.com', 'asana.com', 'slack.com', 'atlassian.com', 'jira.com', 'confluence.com'],
      'Entertainment': ['youtube.com', 'netflix.com', 'hulu.com', 'twitch.tv', 'spotify.com', 'soundcloud.com', 'disneyplus.com'],
      'Shopping': ['amazon.com', 'ebay.com', 'walmart.com', 'etsy.com', 'aliexpress.com', 'target.com', 'bestbuy.com'],
      'News': ['nytimes.com', 'cnn.com', 'bbc.com', 'theguardian.com', 'washingtonpost.com', 'reuters.com', 'bloomberg.com'],
      'Education': ['coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org', 'duolingo.com', 'stackoverflow.com', 'w3schools.com', 'mdn.com'],
    };
    
    // Initialize category durations
    const categoryDurations: Record<string, number> = {};
    Object.keys(categories).forEach(category => {
      categoryDurations[category] = 0;
    });
    categoryDurations['Other'] = 0; // For uncategorized domains
    
    // Calculate time spent in each category
    pageViews.forEach(pageView => {
      let categorized = false;
      const domain = pageView.hostname;
      
      // Check if domain belongs to a defined category
      for (const [category, domains] of Object.entries(categories)) {
        if (domains.some(d => domain.includes(d))) {
          categoryDurations[category] += pageView.totalDuration;
          categorized = true;
          break;
        }
      }
      
      // If not categorized, add to "Other"
      if (!categorized) {
        categoryDurations['Other'] += pageView.totalDuration;
      }
    });
    
    // Sort categories by duration (descending)
    const sortedCategories = Object.entries(categoryDurations)
      .sort((a, b) => b[1] - a[1]);
    
    const labels = sortedCategories.map(([category]) => category);
    const values = sortedCategories.map(([_, duration]) => duration);
    const colors = this.generateChartColors(labels.length);
    
    return { labels, values, colors };
  }
  
  /**
   * Generate data for time distribution by domain over time
   * Shows how time is distributed across top domains over days
   * 
   * @param pageViews - Array of page views to analyze
   * @param days - Number of days to include
   * @param topDomainCount - Number of top domains to include
   * @returns Formatted data for stacked time distribution visualization
   */
  public generateDomainTimeDistributionChartData(pageViews: PageView[], days: number = 7, topDomainCount: number = 5): TimeDistributionData {
    const today = new Date();
    const labels: string[] = [];
    
    // Generate date labels
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      labels.push(dateLabel);
    }
    
    // Get top domains overall
    const topDomains = this.getTopDomains(pageViews, topDomainCount)
      .map(item => item.domain);
    
    // Add "Other" category
    const allDomains = [...topDomains, 'Other'];
    
    // Generate colors for domains
    const domainColors = this.generateChartColors(allDomains.length);
    
    // Create datasets for each domain
    const datasets = allDomains.map((domain, index) => {
      const data: number[] = [];
      
      // For each day, calculate time spent on this domain
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        // Filter page views for this day
        const dayPageViews = this.filterPageViewsByDateRange(pageViews, startOfDay, endOfDay);
        
        if (domain === 'Other') {
          // Calculate time for domains not in top list
          const otherDomains = dayPageViews.filter(pv => !topDomains.includes(pv.hostname));
          const otherTime = this.getTotalBrowsingTime(otherDomains);
          data.push(otherTime);
        } else {
          // Calculate time for this specific domain
          const domainPageViews = dayPageViews.filter(pv => pv.hostname === domain);
          const domainTime = this.getTotalBrowsingTime(domainPageViews);
          data.push(domainTime);
        }
      }
      
      return {
        label: domain,
        data,
        backgroundColor: domainColors[index],
        borderRadius: 4,
      };
    });
    
    return { labels, datasets };
  }
  
  /**
   * Generate data for hourly activity heatmap
   * Shows activity intensity by hour and day of week
   * 
   * @param pageViews - Array of page views to analyze
   * @returns Formatted data for heatmap visualization
   */
  public generateHourlyHeatmapData(pageViews: PageView[]): TimeDistributionData {
    // Day names for labels
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Initialize 2D array for heatmap data [day][hour]
    const heatmapData: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));
    
    // Populate heatmap data
    pageViews.forEach(pageView => {
      pageView.sessions.forEach(session => {
        // For each session, distribute its time across the hours it spans
        let currentTime = session.startTime;
        while (currentTime < session.endTime) {
          const date = new Date(currentTime);
          const day = date.getDay(); // 0-6
          const hour = date.getHours(); // 0-23
          
          // Calculate how much time was spent in this hour
          const hourEnd = new Date(date);
          hourEnd.setHours(hour + 1, 0, 0, 0);
          
          const timeInHour = Math.min(
            (Math.min(hourEnd.getTime(), session.endTime) - currentTime) / 1000,
            3600 // Cap at one hour
          );
          
          heatmapData[day][hour] += timeInHour;
          
          // Move to the next hour
          currentTime = hourEnd.getTime();
        }
      });
    });
    
    // Format data for visualization
    // For heatmap, we'll return a special format that can be processed by the heatmap component
    const datasets = dayNames.map((day, dayIndex) => {
      return {
        label: day,
        data: heatmapData[dayIndex],
        backgroundColor: 'rgba(0,0,0,0)', // Will be colored by the heatmap
        borderRadius: 0,
      };
    });
    
    // Hour labels (0-23)
    const hourLabels = Array.from({ length: 24 }, (_, i) => {
      if (i === 0) return '12 AM';
      if (i < 12) return `${i} AM`;
      if (i === 12) return '12 PM';
      return `${i - 12} PM`;
    });
    
    return { 
      labels: hourLabels,
      datasets,
      // Include the raw data for custom rendering
      values: heatmapData.flat()
    };
  }

  /**
   * Format duration for display
   * Converts seconds to a human-readable format
   * 
   * @param seconds - Duration in seconds
   * @returns Formatted duration string
   */
  public formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  }

  /**
   * Generate an array of colors for charts
   * 
   * @param count - Number of colors to generate
   * @returns Array of color strings in hex format
   */
  private generateChartColors(count: number): string[] {
    // Predefined color palette for better visual appeal
    const palette = [
      '#4285F4', // Google Blue
      '#EA4335', // Google Red
      '#FBBC05', // Google Yellow
      '#34A853', // Google Green
      '#FF6D01', // Orange
      '#46BFBD', // Teal
      '#AC92EC', // Purple
      '#FF8A80', // Light Red
      '#00BCD4', // Cyan
      '#9C27B0', // Deep Purple
      '#3F51B5', // Indigo
      '#2196F3', // Blue
      '#03A9F4', // Light Blue
      '#00BCD4', // Cyan
      '#009688', // Teal
      '#4CAF50', // Green
      '#8BC34A', // Light Green
      '#CDDC39', // Lime
      '#FFEB3B', // Yellow
      '#FFC107', // Amber
      '#FF9800', // Orange
      '#FF5722', // Deep Orange
      '#795548', // Brown
      '#9E9E9E', // Grey
      '#607D8B'  // Blue Grey
    ];
    
    // If we need more colors than in our palette, we'll generate them
    if (count <= palette.length) {
      return palette.slice(0, count);
    }
    
    // Generate additional colors using hue rotation
    const colors: string[] = [...palette];
    
    for (let i = palette.length; i < count; i++) {
      const hue = (i * 137.5) % 360; // Golden angle approximation for good distribution
      colors.push(`hsl(${hue}, 70%, 60%)`);
    }
    
    return colors;
  }

  /**
   * Generate gradient colors between two hex colors
   * 
   * @param startColor - Starting color in hex format
   * @param endColor - Ending color in hex format
   * @param steps - Number of color steps to generate
   * @returns Array of color strings in hex format
   */
  private generateGradientColors(startColor: string, endColor: string, steps: number): string[] {
    // Parse hex colors to RGB
    const start = this.hexToRgb(startColor);
    const end = this.hexToRgb(endColor);
    
    if (!start || !end) {
      return Array(steps).fill(startColor);
    }
    
    const colors: string[] = [];
    
    for (let i = 0; i < steps; i++) {
      const ratio = i / (steps - 1);
      
      // Interpolate RGB values
      const r = Math.round(start.r + ratio * (end.r - start.r));
      const g = Math.round(start.g + ratio * (end.g - start.g));
      const b = Math.round(start.b + ratio * (end.b - start.b));
      
      // Convert back to hex
      colors.push(this.rgbToHex(r, g, b));
    }
    
    return colors;
  }

  /**
   * Convert hex color to RGB
   * 
   * @param hex - Color in hex format
   * @returns RGB color object or null if invalid
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : null;
  }

  /**
   * Convert RGB values to hex color
   * 
   * @param r - Red component (0-255)
   * @param g - Green component (0-255)
   * @param b - Blue component (0-255)
   * @returns Color in hex format
   */
  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b]
      .map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('');
  }
}