import { defineBackground } from 'wxt/sandbox';
import { analyzeHistory, getTodayStats } from '../lib/history-analyzer';
import { saveDailyStats } from '../lib/storage-manager';

export default defineBackground({
  main() {
    // 初始化
    setupAlarms();
    
    // 首次运行时收集数据
    updateDailyStats();
  }
});

// 设置每日定时任务
function setupAlarms() {
  // 每天午夜运行
  chrome.alarms.create('dailyStats', {
    periodInMinutes: 24 * 60, // 每24小时
    when: getNextMidnight() // 下一个午夜时间点
  });
  
  // 每小时更新今日数据
  chrome.alarms.create('updateTodayStats', {
    periodInMinutes: 60 // 每60分钟
  });
  
  // 监听定时器触发
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'dailyStats') {
      // 每天午夜处理
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateString = yesterday.toISOString().split('T')[0];
      
      // 保存昨天的统计
      collectAndSaveStats(dateString);
    } else if (alarm.name === 'updateTodayStats') {
      // 更新今天的统计
      updateDailyStats();
    }
  });
}

// 获取下一个午夜的时间戳
function getNextMidnight(): number {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

// 收集并保存指定日期的统计
async function collectAndSaveStats(dateString: string): Promise<void> {
  const date = new Date(dateString);
  const startTime = date.getTime();
  const endTime = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - 1;
  
  try {
    const stats = await chrome.history.search({
      text: '',
      startTime,
      endTime,
      maxResults: 10000
    });
    
    // 分析和保存历史数据
    const analyzedStats = await analyzeHistory(startTime, endTime);
    await saveDailyStats(dateString, analyzedStats);
  } catch (error) {
    console.error('Error collecting history stats:', error);
  }
}

// 更新今天的统计
async function updateDailyStats(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  try {
    const stats = await getTodayStats();
    await saveDailyStats(today, stats);
  } catch (error) {
    console.error('Error updating today stats:', error);
  }
}