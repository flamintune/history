import { defineConfig } from "wxt";
import path from "path";

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-react"],
  outDir: "dist",
  dev: {
    server: {
      port: 3000,
      hostname: "localhost",
    },
  },
  vite: () => {
    return {
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "./"),
        },
      },
    };
  },
  manifest: {
    name: "CyberSurfing TimeLine BETA",
    description: "统计你的网上冲浪时间线,此扩展程序目前处于 Beta 版测试阶段",
    permissions: [
      "history", // 访问历史记录
      "storage", // 存储统计数据
      "alarms", // 定时任务(用于每日统计)
    ],
    version: "1.0.0",
    options_ui: {
      page: "options.html",
      open_in_tab: true, // 设置为true会在新标签页打开，false则在弹出窗口中打开
    },
    content_scripts: [],
  },
});
