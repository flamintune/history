import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Trash2, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { ConfirmDialog } from './ui/confirm-dialog';
import { clearAllPageViews, deletePageView, autoCleanupPageViewData } from '@/lib/storage-manager';
import { DateRangeSelector } from './DateRangeSelector';
import { PageViewAnalyzer } from '@/lib/page-view-analyzer';
import { PageView } from '@/lib/types';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';

interface DataManagementControlsProps {
  pageViews: PageView[];
  onDataDeleted: () => void;
}

export function DataManagementControls({ pageViews, onDataDeleted }: DataManagementControlsProps) {
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [clearRangeDialogOpen, setClearRangeDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [retentionPeriod, setRetentionPeriod] = useState<string>("30");
  
  const analyzer = new PageViewAnalyzer();
  
  // Calculate stats for display
  const totalPages = pageViews.length;
  const totalDomains = new Set(pageViews.map(pv => pv.hostname)).size;
  const totalTime = analyzer.getTotalBrowsingTime(pageViews);
  
  // Format duration for display
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  // Handle clearing all data
  const handleClearAll = async () => {
    try {
      setIsDeleting(true);
      await clearAllPageViews();
      setMessage({ text: 'All browsing data has been deleted', type: 'success' });
      onDataDeleted();
    } catch (error) {
      console.error('Error clearing all data:', error);
      setMessage({ text: 'Failed to delete browsing data', type: 'error' });
    } finally {
      setIsDeleting(false);
      setClearAllDialogOpen(false);
    }
  };

  // Handle clearing data in a specific date range
  const handleClearRange = async () => {
    if (!startDate || !endDate) {
      setMessage({ text: 'Please select a valid date range', type: 'error' });
      return;
    }

    try {
      setIsDeleting(true);
      
      // Filter page views in the selected date range
      const pageViewsInRange = analyzer.filterPageViewsByDateRange(pageViews, startDate, endDate);
      
      // Delete each page view in the range
      for (const pageView of pageViewsInRange) {
        await deletePageView(pageView.url);
      }
      
      setMessage({ 
        text: `Deleted ${pageViewsInRange.length} page views from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`, 
        type: 'success' 
      });
      onDataDeleted();
    } catch (error) {
      console.error('Error clearing data range:', error);
      setMessage({ text: 'Failed to delete browsing data for the selected range', type: 'error' });
    } finally {
      setIsDeleting(false);
      setClearRangeDialogOpen(false);
    }
  };

  // Handle setting data retention period
  const handleSetRetentionPeriod = async () => {
    try {
      // Run auto cleanup with the specified retention period
      await autoCleanupPageViewData(parseInt(retentionPeriod));
      setMessage({ text: `Data retention period set to ${retentionPeriod} days`, type: 'success' });
      onDataDeleted();
    } catch (error) {
      console.error('Error setting retention period:', error);
      setMessage({ text: 'Failed to set data retention period', type: 'error' });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Data Management</CardTitle>
        <CardDescription>
          Manage your browsing data and privacy settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {message && (
            <div className={`p-2 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message.text}
            </div>
          )}
          
          {/* Data summary */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 p-3 rounded-md text-center">
              <div className="text-2xl font-bold">{totalPages}</div>
              <div className="text-sm text-gray-500">Pages Tracked</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-md text-center">
              <div className="text-2xl font-bold">{totalDomains}</div>
              <div className="text-sm text-gray-500">Domains</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-md text-center">
              <div className="text-2xl font-bold">{formatDuration(totalTime)}</div>
              <div className="text-sm text-gray-500">Total Time</div>
            </div>
          </div>
          
          {/* Delete all data */}
          <div className="border p-4 rounded-md">
            <h3 className="text-sm font-medium mb-2 flex items-center">
              <Trash2 className="h-4 w-4 mr-2 text-red-500" />
              Delete All Browsing Data
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              This will permanently delete all your browsing history data stored by this extension.
            </p>
            <Button 
              variant="destructive" 
              onClick={() => setClearAllDialogOpen(true)}
              disabled={isDeleting || pageViews.length === 0}
            >
              Delete All Data
            </Button>
          </div>
          
          {/* Delete data by date range */}
          <div className="border p-4 rounded-md">
            <h3 className="text-sm font-medium mb-2 flex items-center">
              <Calendar className="h-4 w-4 mr-2 text-orange-500" />
              Delete Data by Date Range
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Select a date range to delete specific browsing data.
            </p>
            <div className="mb-3">
              <DateRangeSelector
                startDate={startDate}
                endDate={endDate}
                onRangeChange={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                }}
              />
            </div>
            <Button 
              variant="destructive" 
              onClick={() => setClearRangeDialogOpen(true)}
              disabled={isDeleting || !startDate || !endDate || pageViews.length === 0}
            >
              Delete Range
            </Button>
          </div>
          
          {/* Data retention settings */}
          <div className="border p-4 rounded-md">
            <h3 className="text-sm font-medium mb-2 flex items-center">
              <Clock className="h-4 w-4 mr-2 text-blue-500" />
              Data Retention Settings
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Set how long browsing data should be kept before automatic deletion.
            </p>
            <div className="flex items-center space-x-2 mb-3">
              <Select
                value={retentionPeriod}
                onValueChange={setRetentionPeriod}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select retention period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">365 days</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={handleSetRetentionPeriod}
                disabled={isDeleting}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start space-y-2">
        <p className="text-xs text-gray-500">
          All data is stored locally on your device and is never sent to external servers.
        </p>
      </CardFooter>
      
      {/* Confirm dialogs */}
      <ConfirmDialog
        open={clearAllDialogOpen}
        onOpenChange={setClearAllDialogOpen}
        onConfirm={handleClearAll}
        title="Delete all browsing data?"
        description="This action cannot be undone. All your browsing history data stored by this extension will be permanently deleted."
      >
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 flex items-start">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-700">
            You are about to delete {totalPages} page records across {totalDomains} domains, 
            representing {formatDuration(totalTime)} of browsing activity.
          </p>
        </div>
      </ConfirmDialog>
      
      <ConfirmDialog
        open={clearRangeDialogOpen}
        onOpenChange={setClearRangeDialogOpen}
        onConfirm={handleClearRange}
        title="Delete data for selected date range?"
        description={`This will permanently delete all browsing data from ${startDate?.toLocaleDateString() || '...'} to ${endDate?.toLocaleDateString() || '...'}.`}
      >
        {startDate && endDate && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700">
              {analyzer.filterPageViewsByDateRange(pageViews, startDate, endDate).length} page records will be deleted.
            </p>
          </div>
        )}
      </ConfirmDialog>
    </Card>
  );
}