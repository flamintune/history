import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityChart } from "@/components/charts/ActivityChart";
import { useHistoryStats } from "@/hooks/useHistoryStats";
import "@/styles/globals.css";

const App: React.FC = () => {
  const { todayStats, isLoading } = useHistoryStats();

  // 打开选项页面
  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage();
  };

  if (isLoading) {
    return (
      <div className="flex h-[400px] w-[400px] items-center justify-center">
        <div className="text-muted-foreground">Loading statistics...</div>
      </div>
    );
  }

  return (
    <div className="flex h-[400px] w-[400px] flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Today's Activity</h1>
        <button
          onClick={openOptionsPage}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Settings
        </button>
      </div>

      {todayStats && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Visits</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{todayStats.totalVisits}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Unique Domains</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{todayStats.uniqueDomains}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Domains</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {todayStats.topDomains.slice(0, 5).map((domain) => (
                  <div
                    key={domain.domain}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{domain.domain}</span>
                    <span className="text-sm text-muted-foreground">
                      {domain.visits} visits
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hourly Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityChart data={todayStats.hourlyActivity} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default App;
