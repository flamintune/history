import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTodayStats } from "@/hooks/useTodayStats";
import { useWeekStats } from "@/hooks/useWeekStats";
import { useTimeStats } from "@/hooks/useTimeStats";
import { usePageViewDetails } from "@/hooks/usePageViewDetails";
import {
  BarChart,
  Globe,
  Star,
  Settings,
  ExternalLink,
  Clock,
  Calendar,
  Shield,
} from "lucide-react";
import { openOptionsPage } from "@/lib/browser";
import { StatCard } from "./components/StatCard";
import { TimeStatsCard } from "./components/TimeStatsCard";
import { SkeletonLoader } from "./components/SkeletonLoader";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { ActivityChart } from "@/components/charts/ActivityChart";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { PageViewDetailList } from "@/components/PageViewDetailList";
import { DataManagementControls } from "@/components/DataManagementControls";
import { DomainExclusionManager } from "@/components/DomainExclusionManager";
import { PrivacySettings } from "@/components/PrivacySettings";
import "@/styles/globals.css";

const App: React.FC = () => {
  const { stats: todayStats, isLoading: isTodayLoading } = useTodayStats();
  const { stats: weekStats, isLoading: isWeekLoading } = useWeekStats();
  const { todayStats: todayTimeStats, weekStats: weekTimeStats, isLoading: isTimeStatsLoading } = useTimeStats();
  
  // Initialize with last 7 days as default date range
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6); // Last 7 days including today
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [endDate, setEndDate] = useState<Date | undefined>(() => new Date());
  
  const { pageViews, loading: pageViewsLoading, handleDelete } = usePageViewDetails({
    startDate,
    endDate
  });
  const [activeTab, setActiveTab] = useState("today");
  
  const handleDateRangeChange = (start: Date | undefined, end: Date | undefined) => {
    setStartDate(start);
    setEndDate(end);
  };
  
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

  const renderStats = (stats: any, timeStats: any, isLoading: boolean, isTimeLoading: boolean) => {
    if (isLoading && isTimeLoading) {
      return <SkeletonLoader />;
    }
    
    if (!stats && !timeStats) {
      return (
        <div className="text-center h-[150px] flex items-center justify-center text-muted-foreground">
          暂无数据
        </div>
      );
    }
    
    // Format total time for display
    const formatTotalTime = (seconds: number): string => {
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
    
    return (
      <div className="space-y-4">
        {/* Combined stats overview */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={BarChart}
            title="总访问"
            value={stats ? stats.totalVisits : 0}
          />
          <StatCard
            icon={Globe}
            title="不同网站"
            value={stats ? stats.uniqueDomains : 0}
          />
          <StatCard
            icon={Clock}
            title="总浏览时间"
            value={timeStats ? formatTotalTime(timeStats.totalTimeToday) : "0m"}
          />
        </div>
        
        {/* Top sites by visits and time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats && stats.topDomains && stats.topDomains.length > 0 && (
            <StatCard
              icon={Star}
              title="最常访问"
              value={stats.topDomains[0].domain}
            />
          )}
          
          {timeStats && timeStats.topSites && timeStats.topSites.length > 0 && (
            <StatCard
              icon={Clock}
              title="最耗时网站"
              value={timeStats.topSites[0].pageTitle || timeStats.topSites[0].hostname}
              subtitle={formatTotalTime(timeStats.topSites[0].totalDuration)}
            />
          )}
        </div>
        
        {/* Detailed time statistics */}
        {timeStats && timeStats.topSites && timeStats.topSites.length > 0 && (
          <TimeStatsCard
            icon={Clock}
            title="最耗时网站"
            pageViews={timeStats.topSites}
            limit={5}
            showTotal={true}
          />
        )}
        
        {/* Activity chart */}
        {stats && (
          <div className="pt-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              小时活动
            </h3>
            <ActivityChart data={stats.hourlyActivity} />
          </div>
        )}
        
        {/* Links to detailed statistics */}
        <div className="pt-2 grid grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setActiveTab("details")}
          >
            详细浏览记录
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setActiveTab("charts")}
          >
            时间分析图表
            <BarChart className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-[400px] p-4 bg-background text-foreground">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">冲浪时间线</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={openOptionsPage}>
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => {}}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "today", label: "今日" },
          { id: "week", label: "本周" },
          { id: "details", label: "详细" },
          { id: "charts", label: "图表" },
          { id: "privacy", label: "隐私" },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="underline"
        className="mb-2"
      />

      <TabPanel id="today" activeTab={activeTab}>
        {renderStats(todayStats, todayTimeStats, isTodayLoading, isTimeStatsLoading)}
      </TabPanel>
      <TabPanel id="week" activeTab={activeTab}>
        {renderStats(weekStats, weekTimeStats, isWeekLoading, isTimeStatsLoading)}
      </TabPanel>
      <TabPanel id="details" activeTab={activeTab}>
        <PageViewDetailList 
          pageViews={pageViews} 
          loading={pageViewsLoading} 
          onDelete={handleDelete}
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={handleDateRangeChange}
        />
      </TabPanel>
      <TabPanel id="charts" activeTab={activeTab}>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">时间分析图表</h3>
            <div className="text-xs text-muted-foreground">
              {pageViews.length} 个页面 | {startDate && endDate ? 
                `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}` : 
                '全部时间'}
            </div>
          </div>
          
          {/* Date range selector for charts */}
          <div className="mb-2">
            <PageViewDetailList 
              pageViews={[]} 
              loading={false}
              onDelete={() => {}}
              startDate={startDate}
              endDate={endDate}
              onDateRangeChange={handleDateRangeChange}
              showOnlyDatePicker={true}
            />
          </div>
          
          {pageViewsLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground">加载图表中...</p>
            </div>
          ) : (
            <div className="h-[400px] overflow-y-auto">
              {pageViews.length > 0 ? (
                <ChartPanel pageViews={pageViews} loading={pageViewsLoading} />
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">所选时间范围内没有浏览数据</p>
                </div>
              )}
            </div>
          )}
        </div>
      </TabPanel>
      
      <TabPanel id="privacy" activeTab={activeTab}>
        <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1">
          <div className="mb-4">
            <PrivacySettings />
          </div>
          
          <div className="mb-4">
            <DomainExclusionManager />
          </div>
          
          <div className="mt-4">
            <DataManagementControls 
              pageViews={pageViews} 
              onDataDeleted={() => {
                // Force a re-render to refresh the data
                window.location.reload();
              }} 
            />
          </div>
        </div>
      </TabPanel>
      
      {/* Footer navigation */}
      <div className="mt-4 pt-2 border-t flex justify-between items-center text-xs text-muted-foreground">
        <div>
          {activeTab !== "today" && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs" 
              onClick={() => setActiveTab("today")}
            >
              返回概览
            </Button>
          )}
        </div>
        <div>
          {!isTimeStatsLoading && todayTimeStats && (
            <span>今日总浏览时间: {formatDuration(todayTimeStats.totalTimeToday)}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
