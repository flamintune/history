import React from "react";

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={activeTab === tab.id ? "active" : ""}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: React.ReactNode;
}

export const TabPanel: React.FC<TabPanelProps> = ({
  id,
  activeTab,
  children,
}) => {
  if (id !== activeTab) return null;

  return <div className="tab-panel">{children}</div>;
};
