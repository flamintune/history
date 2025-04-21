import React, { useState } from "react";
import { useSettings } from "../../hooks/useStorage";
import "../../styles/options.css";

const Options: React.FC = () => {
  const { settings, isLoading, isSaved, updateSetting, saveSettings } =
    useSettings();

  const [newDomain, setNewDomain] = useState("");

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
  const exportData = async () => {
    try {
      // 获取所有可用日期
      const { availableDates = [] } = await chrome.storage.local.get(
        "availableDates"
      );

      // 为每个日期加载统计数据
      const allStats = {};
      for (const date of availableDates) {
        const result = await chrome.storage.local.get(`stats_${date}`);
        allStats[date] = result[`stats_${date}`];
      }

      // 创建下载
      const dataStr = JSON.stringify(allStats, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `history-stats-export-${
        new Date().toISOString().split("T")[0]
      }.json`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting data:", error);
    }
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

  if (isLoading) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <div className="options-container">
      <h1>History Stats Settings</h1>

      <section className="settings-section">
        <h2>Data Collection</h2>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.collectData}
              onChange={handleCollectDataChange}
            />
            Enable data collection
          </label>
          <p className="setting-description">
            When enabled, the extension will collect and analyze your browsing
            history.
          </p>
        </div>

        <div className="setting-item">
          <label>Collection frequency:</label>
          <select
            value={settings.collectionFrequency}
            onChange={handleFrequencyChange}
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
          </select>
          <p className="setting-description">How often to update statistics.</p>
        </div>
      </section>

      <section className="settings-section">
        <h2>Privacy</h2>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.excludeIncognito}
              onChange={handleIncognitoChange}
            />
            Exclude incognito browsing (when possible)
          </label>
        </div>

        <div className="setting-item">
          <label>Excluded domains:</label>
          <div className="tags-input">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addExcludedDomain()}
              placeholder="example.com"
            />
            <button onClick={addExcludedDomain}>Add</button>
          </div>
          <div className="excluded-domains">
            {settings.excludedDomains.map((domain, index) => (
              <span key={index} className="domain-tag">
                {domain}
                <button
                  onClick={() => removeExcludedDomain(index)}
                  className="remove-btn"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section danger-zone">
        <h2>Data Management</h2>

        <div className="setting-item">
          <button onClick={exportData} className="secondary-btn">
            Export All Data
          </button>
          <p className="setting-description">
            Download all your collected statistics as a JSON file.
          </p>
        </div>

        <div className="setting-item">
          <button onClick={confirmClearData} className="danger-btn">
            Clear All Data
          </button>
          <p className="setting-description">
            Delete all collected statistics. This action cannot be undone.
          </p>
        </div>
      </section>

      {isSaved && <div className="save-notice">Settings saved!</div>}
    </div>
  );
};

export default Options;
