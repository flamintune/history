import React, { useState, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PageView } from '@/lib/types';
import { Button } from './ui/button';
import { Trash2, Search, Clock, Globe, BarChart, PieChart, List } from 'lucide-react';
import { ConfirmDialog } from './ui/confirm-dialog';
import { Input } from './ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { PageViewAnalyzer } from '@/lib/page-view-analyzer';
import { DateRangeSelector } from './DateRangeSelector';
import { ChartPanel } from './charts/ChartPanel';
import { Tabs, TabPanel } from './ui/tabs';

interface PageViewDetailListProps {
  pageViews: PageView[];
  loading: boolean;
  onDelete: (url: string) => void;
  startDate?: Date;
  endDate?: Date;
  onDateRangeChange?: (startDate: Date | undefined, endDate: Date | undefined) => void;
  showOnlyDatePicker?: boolean;
}

type SortOption = 'time' | 'recent' | 'domain' | 'title' | 'visits';
type FilterOption = 'all' | 'domain' | 'today' | 'week' | 'custom';

export const PageViewDetailList: React.FC<PageViewDetailListProps> = ({ 
  pageViews, 
  loading, 
  onDelete,
  startDate,
  endDate,
  onDateRangeChange,
  showOnlyDatePicker = false
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('time');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [urlToDelete, setUrlToDelete] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'list' | 'charts'>('list');
  
  const parentRef = useRef<HTMLDivElement>(null);
  const analyzer = new PageViewAnalyzer();

  // Get unique domains for filtering
  const domains = useMemo(() => {
    const uniqueDomains = [...new Set(pageViews.map(pv => pv.hostname))];
    return uniqueDomains.sort();
  }, [pageViews]);

  // Filter and sort page views
  const filteredAndSortedPageViews = useMemo(() => {
    // First apply filters
    let filtered = [...pageViews];
    
    // Domain filter
    if (filterBy === 'domain' && selectedDomain) {
      filtered = filtered.filter(pv => pv.hostname === selectedDomain);
    }
    
    // Time-based filters
    if (filterBy === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();
      filtered = filtered.filter(pv => {
        // Check if any session is from today
        return pv.sessions.some(session => session.startTime >= todayTimestamp);
      });
    } else if (filterBy === 'week') {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek); // Go back to Sunday
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfWeekTimestamp = startOfWeek.getTime();
      
      filtered = filtered.filter(pv => {
        // Check if any session is from this week
        return pv.sessions.some(session => session.startTime >= startOfWeekTimestamp);
      });
    } else if (filterBy === 'custom' && startDate && endDate) {
      // Custom date range filter using the analyzer
      filtered = analyzer.filterPageViewsByDateRange(filtered, startDate, endDate);
    } else if (startDate && endDate && filterBy === 'all') {
      // Always apply date range filter if dates are provided, even if not in custom mode
      filtered = analyzer.filterPageViewsByDateRange(filtered, startDate, endDate);
    }
    
    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pv => 
        pv.url.toLowerCase().includes(query) || 
        pv.hostname.toLowerCase().includes(query) ||
        (pv.pageTitle && pv.pageTitle.toLowerCase().includes(query))
      );
    }
    
    // Then sort
    switch (sortBy) {
      case 'time':
        return filtered.sort((a, b) => b.totalDuration - a.totalDuration);
      case 'recent':
        return filtered.sort((a, b) => b.lastVisited - a.lastVisited);
      case 'domain':
        return filtered.sort((a, b) => a.hostname.localeCompare(b.hostname));
      case 'title':
        return filtered.sort((a, b) => {
          const titleA = a.pageTitle || a.url;
          const titleB = b.pageTitle || b.url;
          return titleA.localeCompare(titleB);
        });
      case 'visits':
        return filtered.sort((a, b) => b.sessions.length - a.sessions.length);
      default:
        return filtered;
    }
  }, [pageViews, sortBy, filterBy, selectedDomain, searchQuery, startDate, endDate, analyzer]);

  const rowVirtualizer = useVirtualizer({
    count: filteredAndSortedPageViews.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimated row height
    overscan: 5,
  });

  const openConfirmDialog = (url: string) => {
    setUrlToDelete(url);
    setDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (urlToDelete) {
      onDelete(urlToDelete);
    }
    setUrlToDelete(null);
    setDialogOpen(false);
  };

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  // Format date for display
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  // If we only want to show the date picker, render just that component
  if (showOnlyDatePicker && onDateRangeChange) {
    return (
      <div className="space-y-2">
        <DateRangeSelector
          startDate={startDate}
          endDate={endDate}
          onRangeChange={(start, end) => {
            onDateRangeChange(start, end);
          }}
        />
      </div>
    );
  }

  if (loading) {
    return <div className="text-center p-4">Loading...</div>;
  }

  if (pageViews.length === 0) {
    return <div className="text-center p-4 text-gray-500">No page view data yet.</div>;
  }

  return (
    <div className="space-y-4">
      {/* View toggle buttons */}
      <div className="flex justify-end space-x-2 mb-2">
        <Button
          variant={activeView === 'list' ? 'default' : 'outline'}
          size="sm"
          className="flex items-center space-x-1"
          onClick={() => setActiveView('list')}
        >
          <List className="h-4 w-4" />
          <span>List</span>
        </Button>
        <Button
          variant={activeView === 'charts' ? 'default' : 'outline'}
          size="sm"
          className="flex items-center space-x-1"
          onClick={() => setActiveView('charts')}
        >
          <BarChart className="h-4 w-4" />
          <span>Charts</span>
        </Button>
      </div>

      {/* Filter and sort controls */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
        </div>
        
        {/* Filter controls */}
        <div className="flex flex-col space-y-3">
          {/* First row: Filter and Sort */}
          <div className="flex items-center space-x-2">
            <div className="flex-1 flex items-center space-x-2">
              <Globe className="h-4 w-4 text-gray-400" />
              <Select
                value={filterBy}
                onValueChange={(value: FilterOption) => {
                  setFilterBy(value);
                  if (value !== 'domain') {
                    setSelectedDomain('');
                  }
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Domains</SelectItem>
                  <SelectItem value="domain">Filter by Domain</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="custom">Custom Date Range</SelectItem>
                </SelectContent>
              </Select>
              
              {filterBy === 'domain' && (
                <Select
                  value={selectedDomain}
                  onValueChange={setSelectedDomain}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map(domain => (
                      <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <Select
                value={sortBy}
                onValueChange={(value: SortOption) => setSortBy(value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Sort by Time</SelectItem>
                  <SelectItem value="recent">Sort by Recent</SelectItem>
                  <SelectItem value="domain">Sort by Domain</SelectItem>
                  <SelectItem value="title">Sort by Title</SelectItem>
                  <SelectItem value="visits">Sort by Visits</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Second row: Date Range Selector */}
          {onDateRangeChange && (
            <div className="flex items-center">
              <div className="w-full">
                <DateRangeSelector
                  startDate={startDate}
                  endDate={endDate}
                  onRangeChange={(start, end) => {
                    onDateRangeChange(start, end);
                    if (start && end && filterBy !== 'custom') {
                      setFilterBy('custom');
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {activeView === 'list' ? (
        <div className="border rounded-md">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 p-3 border-b bg-gray-50 dark:bg-gray-800">
            <div className="col-span-6 font-medium">Page</div>
            <div className="col-span-2 font-medium text-center">Domain</div>
            <div className="col-span-2 font-medium text-center">Duration</div>
            <div className="col-span-2 font-medium text-center">Last Visit</div>
          </div>
          
          {/* Virtualized list */}
          <div ref={parentRef} className="h-[400px] overflow-y-auto">
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                const pageView = filteredAndSortedPageViews[virtualItem.index];
                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="grid grid-cols-12 gap-2 p-3 items-center">
                      <div className="col-span-6 flex items-center space-x-2 overflow-hidden">
                        <img 
                          src={pageView.faviconUrl || './icon/32.png'} 
                          alt="favicon" 
                          className="w-4 h-4 flex-shrink-0"
                          onError={(e) => {
                            // Hide favicon if it fails to load
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="flex flex-col overflow-hidden">
                          <a 
                            href={pageView.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-sm font-medium truncate hover:underline" 
                            title={pageView.pageTitle || pageView.url}
                          >
                            {pageView.pageTitle || pageView.url}
                          </a>
                          <span className="text-xs text-gray-500 truncate" title={pageView.url}>
                            {pageView.url}
                          </span>
                        </div>
                      </div>
                      <div className="col-span-2 text-sm text-center">{pageView.hostname}</div>
                      <div className="col-span-2 text-sm font-medium text-center">{formatDuration(pageView.totalDuration)}</div>
                      <div className="col-span-1 text-xs text-center">{formatDate(pageView.lastVisited)}</div>
                      <div className="col-span-1 flex justify-center">
                        <Button variant="ghost" size="icon" onClick={() => openConfirmDialog(pageView.url)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <ChartPanel pageViews={filteredAndSortedPageViews} loading={loading} />
      )}
      
      {/* Summary */}
      <div className="text-sm text-gray-500 flex justify-between items-center">
        <span>Showing {filteredAndSortedPageViews.length} of {pageViews.length} pages</span>
        <span>Total time: {formatDuration(analyzer.getTotalBrowsingTime(filteredAndSortedPageViews))}</span>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Are you absolutely sure?"
        description="This action cannot be undone. This will permanently delete this page view record."
      />
    </div>
  );
};