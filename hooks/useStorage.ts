import { useState, useEffect } from "react";
import type { UserSettings } from "../lib/types";

const DEFAULT_SETTINGS: UserSettings = {
  collectData: true,
  collectionFrequency: "hourly",
  excludeIncognito: true,
  excludedDomains: [],
};

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  // 加载设置
  useEffect(() => {
    loadSettings();
  }, []);

  // 从storage加载设置
  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
      setSettings(result as UserSettings);
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 保存设置
  const saveSettings = async (newSettings?: Partial<UserSettings>) => {
    try {
      const updatedSettings = {
        ...settings,
        ...newSettings,
      };

      await chrome.storage.sync.set(updatedSettings);
      setSettings(updatedSettings);

      // 显示保存成功提示
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);

      // 通知后台脚本设置已更改
      chrome.runtime.sendMessage({ type: "settingsUpdated" });

      return true;
    } catch (error) {
      console.error("Error saving settings:", error);
      return false;
    }
  };

  // 更新单个设置项
  const updateSetting = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    saveSettings({ [key]: value } as Partial<UserSettings>);
  };

  return {
    settings,
    isLoading,
    isSaved,
    saveSettings,
    updateSetting,
    refreshSettings: loadSettings,
  };
}
