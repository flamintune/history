import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTodayStats } from "@/hooks/useTodayStats";
import { useWeekStats } from "@/hooks/useWeekStats";
import {
  BarChart,
  Globe,
  Star,
  Settings,
  ExternalLink,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { openOptionsPage } from "@/lib/browser";
import { StatCard } from "./components/StatCard";
import { SkeletonLoader } from "./components/SkeletonLoader";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { ActivityChart } from "@/components/charts/ActivityChart";
import "@/styles/globals.css";

const App: React.FC = () => {
  const { stats: todayStats, isLoading: isTodayLoading } = useTodayStats();
  const { stats: weekStats, isLoading: isWeekLoading } = useWeekStats();
  const [activeTab, setActiveTab] = useState("today");

  const renderStats = (stats: any, isLoading: boolean) => {
    if (isLoading) {
      return <SkeletonLoader />;
    }
    if (!stats) {
      return (
        <div className="text-center h-[150px] flex items-center justify-center text-muted-foreground">
          暂无数据
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            icon={BarChart}
            title="总访问"
            value={stats.totalVisits}
          />
          <StatCard
            icon={Globe}
            title="不同网站"
            value={stats.uniqueDomains}
          />
        </div>
        {stats.topDomains && stats.topDomains.length > 0 && (
          <StatCard
            icon={Star}
            title="最常访问"
            value={stats.topDomains[0].domain}
          />
        )}
        <div className="pt-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            小时活动
          </h3>
          <ActivityChart data={stats.hourlyActivity} />
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
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="underline"
        className="mb-2"
      />

      <TabPanel id="today" activeTab={activeTab}>
        {renderStats(todayStats, isTodayLoading)}
      </TabPanel>
      <TabPanel id="week" activeTab={activeTab}>
        {renderStats(weekStats, isWeekLoading)}
      </TabPanel>
    </div>
  );
};

export default App;
