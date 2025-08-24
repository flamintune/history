import React, { useMemo } from 'react';
import { PageView } from '@/lib/types';
import { PageViewAnalyzer } from '@/lib/page-view-analyzer';
import { TimeDistributionChart } from './TimeDistributionChart';
import { DomainPieChart } from './DomainPieChart';
import { TimeTrendChart } from './TimeTrendChart';
import { CategoryBarChart } from './CategoryBarChart';
import { ActivityHeatmap } from './ActivityHeatmap';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabPanel } from '@/components/ui/tabs';

interface ChartPanelProps {
  pageViews: PageView[];
  loading: boolean;
}

export const ChartPanel: React.FC<ChartPanelProps> = ({ pageViews, loading }) => {
  const [activeTab, setActiveTab] = React.useState('domains');
  const analyzer = useMemo(() => new PageViewAnalyzer(), []);

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
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  };

  // Generate chart data
  const domainPieChartData = useMemo(() => {
    return analyzer.generateDomainPieChartData(pageViews);
  }, [pageViews, analyzer]);

  const hourlyBarChartData = useMemo(() => {
    return analyzer.generateHourlyBarChartData(pageViews);
  }, [pageViews, analyzer]);

  const dailyBarChartData = useMemo(() => {
    return analyzer.generateDailyBarChartData(pageViews);
  }, [pageViews, analyzer]);

  const topSitesChartData = useMemo(() => {
    return analyzer.generateTopSitesChartData(pageViews);
  }, [pageViews, analyzer]);
  
  const timeTrendChartData = useMemo(() => {
    return analyzer.generateTimeTrendChartData(pageViews);
  }, [pageViews, analyzer]);
  
  // New chart data for enhanced visualizations
  const domainCategoryChartData = useMemo(() => {
    return analyzer.generateDomainCategoryChartData(pageViews);
  }, [pageViews, analyzer]);
  
  const domainTimeDistributionData = useMemo(() => {
    return analyzer.generateDomainTimeDistributionChartData(pageViews);
  }, [pageViews, analyzer]);
  
  const activityHeatmapData = useMemo(() => {
    return analyzer.generateHourlyHeatmapData(pageViews);
  }, [pageViews, analyzer]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">Loading charts...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pageViews.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">No data available for visualization</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <Tabs
          tabs={[
            { id: 'domains', label: 'Domains' },
            { id: 'categories', label: 'Categories' },
            { id: 'hourly', label: 'Hourly' },
            { id: 'daily', label: 'Daily' },
            { id: 'sites', label: 'Top Sites' },
            { id: 'trends', label: 'Time Trends' },
            { id: 'stacked', label: 'Domain Trends' },
            { id: 'heatmap', label: 'Activity Map' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="underline"
          className="mb-4"
        />

        <TabPanel id="domains" activeTab={activeTab}>
          <DomainPieChart
            data={domainPieChartData}
            title="Time Distribution by Domain"
            formatValue={formatDuration}
            height={300}
          />
        </TabPanel>
        
        <TabPanel id="categories" activeTab={activeTab}>
          <CategoryBarChart
            data={domainCategoryChartData}
            title="Time Distribution by Category"
            formatValue={formatDuration}
            height={300}
          />
        </TabPanel>

        <TabPanel id="hourly" activeTab={activeTab}>
          <TimeDistributionChart
            data={hourlyBarChartData}
            title="Time Distribution by Hour of Day"
            formatValue={formatDuration}
            height={300}
          />
        </TabPanel>

        <TabPanel id="daily" activeTab={activeTab}>
          <TimeDistributionChart
            data={dailyBarChartData}
            title="Time Distribution by Day of Week"
            formatValue={formatDuration}
            height={300}
          />
        </TabPanel>

        <TabPanel id="sites" activeTab={activeTab}>
          <TimeDistributionChart
            data={topSitesChartData}
            title="Top Time-Consuming Sites"
            formatValue={formatDuration}
            height={300}
          />
        </TabPanel>
        
        <TabPanel id="trends" activeTab={activeTab}>
          <TimeTrendChart
            data={timeTrendChartData}
            title="Browsing Time Trends (Last 7 Days)"
            formatValue={formatDuration}
            height={300}
          />
        </TabPanel>
        
        <TabPanel id="stacked" activeTab={activeTab}>
          <CategoryBarChart
            data={domainTimeDistributionData}
            title="Domain Time Distribution (Last 7 Days)"
            formatValue={formatDuration}
            height={300}
            stacked={true}
          />
        </TabPanel>
        
        <TabPanel id="heatmap" activeTab={activeTab}>
          <ActivityHeatmap
            data={activityHeatmapData}
            title="Weekly Activity Heatmap"
            formatValue={formatDuration}
            height={300}
          />
        </TabPanel>
      </CardContent>
    </Card>
  );
};