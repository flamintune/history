import React from "react";
import { Button } from "@/components/ui/button";
import { useTodayStats } from "@/hooks/useTodayStats";
import { BarChart, Globe, Star, Settings, ExternalLink } from "lucide-react";
import { openOptionsPage } from "@/lib/browser";
import { StatCard } from "./components/StatCard";
import { SkeletonLoader } from "./components/SkeletonLoader";
import "@/styles/globals.css";

const App: React.FC = () => {
  const { stats: todayStats, isLoading } = useTodayStats();

  return (
    <div className="w-[350px] p-4 bg-background text-foreground">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">今日概览</h1>
        <Button variant="ghost" size="icon" onClick={openOptionsPage}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <SkeletonLoader />
      ) : todayStats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon={BarChart}
              title="总访问"
              value={todayStats.totalVisits}
            />
            <StatCard
              icon={Globe}
              title="不同网站"
              value={todayStats.uniqueDomains}
            />
          </div>

          {todayStats.topDomains && todayStats.topDomains.length > 0 && (
            <StatCard
              icon={Star}
              title="最常访问"
              value={todayStats.topDomains[0].domain}
            />
          )}

          <Button
            className="w-full mt-4 flex items-center gap-2"
            onClick={openOptionsPage}
          >
            查看完整时间线
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="text-center h-[150px] flex items-center justify-center text-muted-foreground">
          暂无今日数据
        </div>
      )}
    </div>
  );
};

export default App;
