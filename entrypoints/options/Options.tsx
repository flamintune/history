import React, { useState, useEffect } from "react";
import { useSettings } from "../../hooks/useStorage";
import "../../styles/options.css";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Clock,
  Globe,
  ArrowUpRight,
  Timer,
  Calendar,
  BarChart,
  Search,
  Download,
  Filter,
} from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import "@/styles/globals.css";
import "react-day-picker/dist/style.css";
import { DateRange } from "react-day-picker";
import {
  format,
  addDays,
  startOfToday,
  endOfToday,
  isSameDay,
  parse,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Brush,
} from "recharts";
import { DayPicker } from "react-day-picker";

interface HistoryItem {
  id: string;
  title: string;
  url: string;
  lastVisitTime: number;
  visitCount: number;
}

interface GroupedHistoryItems {
  hour: number;
  items: HistoryItem[];
}

interface DomainStats {
  domain: string;
  visits: number;
  percentage: number;
}

interface HourlyVisit {
  timestamp: number;
  hour: number;
  date: string;
  visits: number;
  label: string;
  isEmptySequence?: boolean;
}

interface Statistics {
  totalVisits: number;
  uniqueDomains: number;
  mostVisitedDomain: {
    domain: string;
    count: number;
  };
  hourlyVisits: HourlyVisit[];
  mostActiveHour: {
    timestamp: number;
    hour: number;
    date: string;
    visits: number;
    label: string;
  };
  domainStats: DomainStats[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.8)",
  "hsl(var(--primary) / 0.6)",
  "hsl(var(--primary) / 0.4)",
  "hsl(var(--primary) / 0.2)",
];

const Options: React.FC = () => {
  const { settings, isLoading, isSaved, updateSetting, saveSettings } =
    useSettings();

  const [newDomain, setNewDomain] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeRange, setTimeRange] = useState<"custom" | "24h" | "week">("24h");
  const [groupedHistoryItems, setGroupedHistoryItems] = useState<
    GroupedHistoryItems[]
  >([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [minVisits, setMinVisits] = useState<string>("");
  const [statistics, setStatistics] = useState<Statistics>({
    totalVisits: 0,
    uniqueDomains: 0,
    mostVisitedDomain: {
      domain: "",
      count: 0,
    },
    hourlyVisits: [],
    mostActiveHour: {
      timestamp: 0,
      hour: 0,
      date: "",
      visits: 0,
      label: "",
    },
    domainStats: [] as DomainStats[],
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfToday(),
    to: endOfToday(),
  });
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(
    undefined
  );
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(
    undefined
  );

  const getStartTime = () => {
    const now = new Date();
    switch (timeRange) {
      case "24h":
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case "week":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "custom":
      default:
        return dateRange?.from || startOfToday();
    }
  };

  const getEndTime = () => {
    const now = new Date();
    switch (timeRange) {
      case "24h":
      case "week":
        return now;
      case "custom":
      default:
        return dateRange?.to || endOfToday();
    }
  };

  // 添加一个工具函数来合并连续的空白时间段
  const mergeEmptyTimeSlots = (visits: HourlyVisit[]): HourlyVisit[] => {
    if (visits.length === 0) return visits;

    const result: HourlyVisit[] = [];
    let emptySequence: HourlyVisit[] = [];

    const formatEmptySequence = (sequence: HourlyVisit[]) => {
      if (sequence.length === 0) return null;
      if (sequence.length === 1) return sequence[0];

      const first = sequence[0];
      const last = sequence[sequence.length - 1];
      const firstDate = new Date(first.timestamp);
      const lastDate = new Date(last.timestamp);

      return {
        ...first,
        label: `${format(firstDate, "MM-dd HH:00")} ~ ${format(
          lastDate,
          "MM-dd HH:00"
        )}`,
        isEmptySequence: true,
      };
    };

    for (let i = 0; i < visits.length; i++) {
      const current = visits[i];

      if (current.visits === 0) {
        emptySequence.push(current);
      } else {
        // 处理之前的空白序列
        const mergedEmpty = formatEmptySequence(emptySequence);
        if (mergedEmpty) {
          result.push(mergedEmpty);
        }
        emptySequence = [];
        result.push(current);
      }
    }

    // 处理最后的空白序列
    const mergedEmpty = formatEmptySequence(emptySequence);
    if (mergedEmpty) {
      result.push(mergedEmpty);
    }

    return result;
  };

  const processTimeData = (
    items: HistoryItem[],
    startTime: Date,
    endTime: Date
  ) => {
    const domainCounts = new Map<string, number>();
    const hourlyVisitsMap = new Map<string, number>();

    // 确保所有时间都在有效范围内
    const validItems = items.filter((item) => {
      const itemTime = new Date(item.lastVisitTime);
      return itemTime >= startTime && itemTime <= endTime;
    });

    validItems.forEach((item) => {
      const domain = getDomain(item.url);
      domainCounts.set(
        domain,
        (domainCounts.get(domain) || 0) + item.visitCount
      );

      const itemDate = new Date(item.lastVisitTime);
      // 确保时间戳是有效的
      if (!isNaN(itemDate.getTime())) {
        const hour = itemDate.getHours();
        const dateStr = format(itemDate, "yyyy-MM-dd");
        const timeKey = `${dateStr}-${hour}`;
        hourlyVisitsMap.set(
          timeKey,
          (hourlyVisitsMap.get(timeKey) || 0) + item.visitCount
        );
      }
    });

    // 生成所有时间点（包括没有访问记录的时间点）
    const allTimePoints = new Map<string, number>();
    let currentTime = new Date(startTime);
    while (currentTime <= endTime) {
      const dateStr = format(currentTime, "yyyy-MM-dd");
      const hour = currentTime.getHours();
      const timeKey = `${dateStr}-${hour}`;
      if (!allTimePoints.has(timeKey)) {
        allTimePoints.set(timeKey, hourlyVisitsMap.get(timeKey) || 0);
      }
      currentTime = new Date(currentTime.getTime() + 3600000); // 增加一小时
    }

    // 转换为数组并排序
    const hourlyVisitsArray: HourlyVisit[] = Array.from(allTimePoints.entries())
      .map(([timeKey, visits]) => {
        // 修复时间键的解析
        const [dateStr, hourStr] = timeKey.split("-").slice(-2); // 取最后两个部分
        const dateParts = timeKey.split("-").slice(0, 3); // 取前三个部分作为日期
        const hour = parseInt(hourStr);

        console.log("Debug date parsing:", {
          timeKey,
          dateParts,
          dateStr,
          hourStr,
          hour,
        });

        // 使用完整的日期部分
        const [year, month, day] = dateParts.map((num) => parseInt(num));
        const date = new Date(year, month - 1, day);

        console.log("Parsed date:", date, { year, month, day });

        return {
          timestamp: date.getTime() + hour * 3600000,
          hour,
          date: dateParts.join("-"), // 使用完整的日期字符串
          visits,
          label: `${format(date, "MM-dd")} ${hour
            .toString()
            .padStart(2, "0")}:00`,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    // 找出最活跃的小时
    const mostActiveHour = hourlyVisitsArray.reduce(
      (max, current) => (current.visits > max.visits ? current : max),
      hourlyVisitsArray[0] || {
        timestamp: 0,
        hour: 0,
        date: "",
        visits: 0,
        label: "",
      }
    );

    // 找出最常访问的域名
    let maxDomain = "";
    let maxCount = 0;
    domainCounts.forEach((count, domain) => {
      if (count > maxCount) {
        maxCount = count;
        maxDomain = domain;
      }
    });

    // 在返回前合并空白时间段
    const mergedHourlyVisits = mergeEmptyTimeSlots(hourlyVisitsArray);

    return {
      totalVisits: validItems.length,
      uniqueDomains: domainCounts.size,
      mostVisitedDomain: {
        domain: maxDomain,
        count: maxCount,
      },
      hourlyVisits: mergedHourlyVisits,
      mostActiveHour,
      domainStats: Array.from(domainCounts.entries()).map(
        ([domain, visits]) => ({
          domain,
          visits,
          percentage: Number(((visits / validItems.length) * 100).toFixed(1)),
        })
      ),
    };
  };

  useEffect(() => {
    const fetchHistory = async () => {
      setIsHistoryLoading(true);
      const startTime = getStartTime();
      const endTime = getEndTime();

      chrome.history.search(
        {
          text: "",
          startTime: startTime.getTime(),
          endTime: endTime.getTime(),
          maxResults: 10000,
        },
        async (items) => {
          const detailedItems = await Promise.all(
            items
              .filter((item) => item.lastVisitTime && item.title && item.url)
              .filter((item) => {
                if (!searchQuery) return true;
                return (
                  item.title
                    ?.toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                  item.url?.toLowerCase().includes(searchQuery.toLowerCase())
                );
              })
              .map(async (item) => {
                const visits = await new Promise<chrome.history.VisitItem[]>(
                  (resolve) => {
                    chrome.history.getVisits({ url: item.url! }, resolve);
                  }
                );

                const periodVisits = visits.filter(
                  (visit) =>
                    visit.visitTime &&
                    visit.visitTime >= startTime.getTime() &&
                    visit.visitTime <= endTime.getTime()
                );

                return {
                  id: item.id || Math.random().toString(),
                  title: item.title || "",
                  url: item.url || "",
                  lastVisitTime: item.lastVisitTime || 0,
                  visitCount: periodVisits.length,
                };
              })
          );

          // 使用新的时间处理函数
          const statistics = processTimeData(detailedItems, startTime, endTime);
          setStatistics(statistics);

          // 处理分组显示
          const grouped = detailedItems.reduce<GroupedHistoryItems[]>(
            (acc, item) => {
              const hour = new Date(item.lastVisitTime).getHours();
              const existingGroup = acc.find((g) => g.hour === hour);

              if (existingGroup) {
                existingGroup.items.push(item);
              } else {
                acc.push({
                  hour,
                  items: [item],
                });
              }

              return acc;
            },
            []
          );

          const sortedGrouped = grouped
            .sort((a, b) => {
              const aTime = Math.max(
                ...a.items.map((item) => item.lastVisitTime)
              );
              const bTime = Math.max(
                ...b.items.map((item) => item.lastVisitTime)
              );
              return bTime - aTime;
            })
            .map((group) => ({
              ...group,
              items: group.items.sort(
                (a, b) => b.lastVisitTime - a.lastVisitTime
              ),
            }));

          setGroupedHistoryItems(sortedGrouped);
          setIsHistoryLoading(false);

          // 设置 Brush 的默认范围（例如，显示最后 48 个点，如果数据足够多）
          if (statistics.hourlyVisits.length > 48) {
            setBrushStartIndex(statistics.hourlyVisits.length - 48);
            setBrushEndIndex(statistics.hourlyVisits.length - 1);
          } else {
            setBrushStartIndex(0);
            setBrushEndIndex(statistics.hourlyVisits.length - 1);
          }
        }
      );
    };

    fetchHistory();
  }, [timeRange, dateRange, searchQuery]);

  // 处理表单更改
  const handleCollectDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSetting("collectData", e.target.checked);
  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSetting("collectionFrequency", e.target.value as "hourly" | "daily");
  };

  const handleIncognitoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSetting("excludeIncognito", e.target.checked);
  };

  // 添加排除的域名
  const addExcludedDomain = () => {
    const domain = newDomain.trim();
    if (domain && !settings.excludedDomains.includes(domain)) {
      updateSetting("excludedDomains", [...settings.excludedDomains, domain]);
      setNewDomain("");
    }
  };

  // 移除排除的域名
  const removeExcludedDomain = (index: number) => {
    const newDomains = [...settings.excludedDomains];
    newDomains.splice(index, 1);
    updateSetting("excludedDomains", newDomains);
  };

  // 导出数据
  const exportData = () => {
    const data = {
      timeRange,
      dateRange,
      statistics,
      history: groupedHistoryItems,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `history-${format(new Date(), "yyyy-MM-dd-HH-mm")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 确认清除数据
  const confirmClearData = () => {
    if (
      window.confirm(
        "Are you sure you want to delete all collected statistics? This action cannot be undone."
      )
    ) {
      clearAllData();
    }
  };

  // 清除所有数据
  const clearAllData = async () => {
    try {
      const { availableDates = [] } = await chrome.storage.local.get(
        "availableDates"
      );

      // 删除每个日期的统计数据
      for (const date of availableDates) {
        await chrome.storage.local.remove(`stats_${date}`);
      }

      // 清除日期列表
      await chrome.storage.local.remove("availableDates");

      alert("All data has been cleared successfully.");
    } catch (error) {
      console.error("Error clearing data:", error);
      alert("An error occurred while clearing data.");
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatHour = (hour: number, timestamp: number) => {
    const date = new Date(timestamp);
    return `${format(date, "yyyy年MM月dd日 EEEE", { locale: zhCN })} ${hour
      .toString()
      .padStart(2, "0")}:00`;
  };

  const getDomain = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return url;
    }
  };

  const getVisitCountStyle = (count: number) => {
    if (count >= 20) return "bg-primary text-primary-foreground font-medium";
    if (count >= 10) return "bg-primary/20 text-primary font-medium";
    return "text-muted-foreground";
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  const openUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 固定筛选器 */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="container mx-auto py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap flex-1">
              <Select
                value={timeRange}
                onValueChange={(value: typeof timeRange) => setTimeRange(value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="选择时间范围" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">自定义范围</SelectItem>
                  <SelectItem value="24h">最近24小时</SelectItem>
                  <SelectItem value="week">最近一周</SelectItem>
                </SelectContent>
              </Select>

              {timeRange === "custom" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="min-w-[240px] justify-start"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "PPP", { locale: zhCN })} -{" "}
                            {format(dateRange.to, "PPP", { locale: zhCN })}
                          </>
                        ) : (
                          format(dateRange.from, "PPP", { locale: zhCN })
                        )
                      ) : (
                        "选择日期范围"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <DayPicker
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      locale={zhCN}
                      className="border-none p-0"
                      classNames={{
                        months:
                          "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                        month: "space-y-4",
                        caption:
                          "flex justify-center pt-1 relative items-center",
                        caption_label: "text-sm font-medium",
                        nav: "space-x-1 flex items-center",
                        nav_button:
                          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex",
                        head_cell:
                          "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
                        row: "flex w-full mt-2",
                        cell: cn(
                          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent",
                          "first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
                        ),
                        day: cn(
                          "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
                          "hover:bg-accent hover:text-accent-foreground"
                        ),
                        day_selected:
                          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                        day_today: "bg-accent text-accent-foreground",
                        day_outside: "text-muted-foreground opacity-50",
                        day_disabled: "text-muted-foreground opacity-50",
                        day_range_middle:
                          "aria-selected:bg-accent aria-selected:text-accent-foreground",
                        day_hidden: "invisible",
                      }}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">域名筛选</h4>
                      <Input
                        placeholder="输入域名..."
                        value={domainFilter}
                        onChange={(e) => setDomainFilter(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">最少访问次数</h4>
                      <Input
                        type="number"
                        placeholder="输入次数..."
                        value={minVisits}
                        onChange={(e) => setMinVisits(e.target.value)}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <div className="relative w-[240px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索标题或网址..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              <Button variant="outline" size="icon" onClick={exportData}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="container mx-auto p-8 space-y-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="transition-all hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart className="h-5 w-5 text-primary" />
                总访问次数
              </CardTitle>
              <p className="text-3xl font-bold text-primary">
                {statistics.totalVisits}
              </p>
            </CardHeader>
          </Card>
          <Card className="transition-all hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="h-5 w-5 text-primary" />
                不同网站数
              </CardTitle>
              <p className="text-3xl font-bold text-primary">
                {statistics.uniqueDomains}
              </p>
            </CardHeader>
          </Card>
          <Card className="transition-all hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Timer className="h-5 w-5 text-primary" />
                最常访问
              </CardTitle>
              <div className="mt-2">
                <p className="text-lg font-medium text-primary">
                  {statistics.mostVisitedDomain.domain}
                </p>
                <p className="text-sm text-muted-foreground">
                  访问 {statistics.mostVisitedDomain.count} 次
                </p>
              </div>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* 访问趋势图表 */}
          <Card className="p-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5 text-primary" />
                访问趋势
              </CardTitle>
            </CardHeader>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={statistics.hourlyVisits}
                  margin={{
                    top: 10,
                    right: 30,
                    left: 0,
                    bottom: 5,
                  }}
                >
                  <defs>
                    <linearGradient
                      id="visitGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis
                    dataKey="label"
                    className="text-muted-foreground"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    tick={(props) => {
                      const { x, y, payload } = props;
                      const isEmptySequence = payload.value.includes("~");
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text
                            x={0}
                            y={0}
                            dy={16}
                            textAnchor="end"
                            fill="currentColor"
                            className={cn(
                              "text-xs",
                              isEmptySequence
                                ? "text-muted-foreground/50"
                                : "text-muted-foreground"
                            )}
                            transform="rotate(-45)"
                          >
                            {payload.value}
                          </text>
                        </g>
                      );
                    }}
                  />
                  <YAxis className="text-muted-foreground" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as HourlyVisit;
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <p className="text-sm font-medium">
                              {data.isEmptySequence ? (
                                <span className="text-muted-foreground">
                                  无访问记录时段
                                </span>
                              ) : (
                                format(
                                  new Date(data.timestamp),
                                  "yyyy年MM月dd日",
                                  { locale: zhCN }
                                )
                              )}
                            </p>
                            <p className="text-sm font-medium">{data.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {`${data.visits} 次访问`}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="visits"
                    stroke="hsl(var(--primary))"
                    fill="url(#visitGradient)"
                  />
                  <Brush
                    dataKey="label"
                    height={30}
                    stroke="hsl(var(--primary) / 0.5)"
                    fill="hsl(var(--muted))"
                    travellerWidth={10}
                    startIndex={brushStartIndex}
                    endIndex={brushEndIndex}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 域名分布饼图 */}
          <Card className="p-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                域名分布
              </CardTitle>
            </CardHeader>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statistics.domainStats.slice(0, 5)}
                    dataKey="visits"
                    nameKey="domain"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ domain, percentage }) =>
                      `${domain} (${percentage.toFixed(1)}%)`
                    }
                  >
                    {statistics.domainStats.slice(0, 5).map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <p className="text-sm font-medium">{data.domain}</p>
                            <p className="text-sm text-muted-foreground">
                              {data.visits} 次访问 ({data.percentage.toFixed(1)}
                              %)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* 历史记录列表 */}
        <div className="space-y-8">
          {isHistoryLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-lg text-muted-foreground">
                加载历史记录中...
              </div>
            </div>
          ) : groupedHistoryItems.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-lg text-muted-foreground">
                {searchQuery ? "没有找到匹配的记录" : "暂无历史记录"}
              </div>
            </div>
          ) : (
            groupedHistoryItems.map((group) => (
              <div key={group.hour} className="space-y-8">
                {/* 小时分割线 */}
                <div className="relative mb-6">
                  <div className="w-full">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-primary/20" />
                      <div className="flex items-center gap-2 bg-background px-2">
                        <Clock className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium text-primary">
                          {formatHour(group.hour, group.items[0].lastVisitTime)}
                        </span>
                      </div>
                      <div className="h-px flex-1 bg-primary/20" />
                    </div>
                  </div>
                </div>

                {group.items.map((item) => (
                  <Card
                    key={item.id}
                    className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
                    onClick={() => openUrl(item.url)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-4 text-sm mb-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{formatTime(item.lastVisitTime)}</span>
                        </div>
                        <div
                          className={cn(
                            "flex items-center gap-2 rounded-full px-2 py-0.5",
                            getVisitCountStyle(item.visitCount)
                          )}
                        >
                          <Timer className="h-4 w-4" />
                          <span>访问 {item.visitCount} 次</span>
                        </div>
                      </div>
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm text-muted-foreground font-medium">
                              {getDomain(item.url)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground truncate max-w-[500px]">
                            {item.url}
                          </span>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:text-primary/80 p-1 hover:bg-muted rounded-md transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </a>
                      </div>
                      <CardTitle className="text-lg mt-2 line-clamp-2">
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Options;
