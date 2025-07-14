import { defineBackground } from "wxt/sandbox";
import { getTodayStats, getWeekStats } from "@/lib/history-analyzer";
import { saveData, STORAGE_KEYS } from "@/lib/storage-manager";

const ALARM_NAME = "update-stats-alarm";

async function updateStats() {
  console.log("Updating stats...");
  try {
    const todayStats = await getTodayStats();
    await saveData(STORAGE_KEYS.todayStats, todayStats);

    const weekStats = await getWeekStats();
    await saveData(STORAGE_KEYS.weekStats, weekStats);

    console.log("Stats updated successfully.");
  } catch (error) {
    console.error("Error updating stats:", error);
  }
}

export default defineBackground({
  main() {
    // 扩展安装或浏览器启动时立即运行
    chrome.runtime.onStartup.addListener(updateStats);
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install" || details.reason === "update") {
        updateStats();
      }
    });

    // 创建一个定时器，定期更新数据
    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: 15, // 每 15 分钟更新一次
      delayInMinutes: 1, // 1 分钟后第一次执行
    });

    // 监听定时器
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARM_NAME) {
        updateStats();
      }
    });

    // 为了确保弹窗能立即响应，在 main 函数第一次执行时也更新一次
    updateStats();
  },
});