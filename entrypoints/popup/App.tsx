import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useHistoryStats } from "@/hooks/useHistoryStats";
import { BarChart, Globe, Star, Settings, ExternalLink } from "lucide-react";
import "@/styles/globals.css";

const App: React.FC = () => {
  const { todayStats, isLoading } = useHistoryStats();

  // 打开选项页面
  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div className="w-[350px] p-4 bg-background text-foreground">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">今日概览</h1>
        <Button variant="ghost" size="icon" onClick={openOptionsPage}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-[150px] space-y-2">
          {/* 骨架屏 */}
          <div className="animate-pulse flex space-x-4 w-full">
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-8 bg-muted rounded"></div>
            </div>
          </div>
          <div className="animate-pulse flex space-x-4 w-full">
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-8 bg-muted rounded"></div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground pt-2">加载中...</div>
        </div>
      ) : todayStats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="flex items-center text-sm font-medium text-muted-foreground">
                  <BarChart className="h-4 w-4 mr-2" />
                  总访问
                </CardTitle>
                <p className="text-2xl font-bold">{todayStats.totalVisits}</p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="flex items-center text-sm font-medium text-muted-foreground">
                  <Globe className="h-4 w-4 mr-2" />
                  不同网站
                </CardTitle>
                <p className="text-2xl font-bold">{todayStats.uniqueDomains}</p>
              </CardHeader>
            </Card>
          </div>

          {todayStats.topDomains && todayStats.topDomains.length > 0 && (
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="flex items-center text-sm font-medium text-muted-foreground">
                  <Star className="h-4 w-4 mr-2" />
                  最常访问
                </CardTitle>
                <div className="mt-1">
                  <p className="text-lg font-semibold truncate">
                    {todayStats.topDomains[0].domain}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {todayStats.topDomains[0].visits} 次访问
                  </p>
                </div>
              </CardHeader>
            </Card>
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
