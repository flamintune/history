import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LucideIcon, Clock } from 'lucide-react';
import { PageView } from '@/lib/types';
import { PageViewAnalyzer } from '@/lib/page-view-analyzer';

interface TimeStatsCardProps {
  icon?: LucideIcon;
  title: string;
  pageViews: PageView[];
  limit?: number;
  showTotal?: boolean;
}

export const TimeStatsCard: React.FC<TimeStatsCardProps> = ({ 
  icon: Icon = Clock, 
  title, 
  pageViews,
  limit = 5,
  showTotal = false
}) => {
  const analyzer = new PageViewAnalyzer();
  const topPages = analyzer.getMostTimeConsumingPages(pageViews, limit);
  const totalDuration = analyzer.getTotalBrowsingTime(pageViews);

  // Enhanced format duration function with more detailed output
  const formatDuration = (seconds: number, detailed: boolean = false): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return detailed && remainingSeconds > 0 
        ? `${minutes}m ${remainingSeconds}s` 
        : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = Math.round(seconds % 60);
      
      if (detailed) {
        if (minutes > 0 && remainingSeconds > 0) {
          return `${hours}h ${minutes}m ${remainingSeconds}s`;
        } else if (minutes > 0) {
          return `${hours}h ${minutes}m`;
        } else if (remainingSeconds > 0) {
          return `${hours}h ${remainingSeconds}s`;
        }
      }
      
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  };

  // Format percentage of total time
  const formatPercentage = (duration: number): string => {
    if (totalDuration === 0) return '0%';
    const percentage = (duration / totalDuration) * 100;
    return `${Math.round(percentage)}%`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <div className="flex items-center">
            <Icon className="h-4 w-4 mr-2" />
            {title}
          </div>
          {showTotal && (
            <span className="text-xs text-muted-foreground">
              总计: {formatDuration(totalDuration, true)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {topPages.length > 0 ? (
          <ul className="space-y-2">
            {topPages.map((page, index) => (
              <li key={index} className="flex items-center justify-between">
                <div className="flex items-center max-w-[65%]">
                  {page.faviconUrl && (
                    <img 
                      src={page.faviconUrl} 
                      alt="" 
                      className="h-4 w-4 mr-2"
                      onError={(e) => {
                        // Hide favicon if it fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <span className="text-sm truncate" title={page.pageTitle || page.url}>
                    {page.pageTitle || page.hostname}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium">{formatDuration(page.totalDuration)}</span>
                  <span className="text-xs text-muted-foreground">{formatPercentage(page.totalDuration)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-2 text-sm text-muted-foreground">
            暂无数据
          </div>
        )}
      </CardContent>
    </Card>
  );
};