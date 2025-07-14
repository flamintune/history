import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const tabsVariants = cva("flex gap-2 border-b", {
  variants: {
    variant: {
      default:
        "border-border",
      underline: "border-transparent",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const tabVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        underline:
          "border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface TabsProps extends VariantProps<typeof tabsVariants> {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  tabClassName?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant,
  className,
  tabClassName,
}) => {
  return (
    <div className={cn(tabsVariants({ variant }), className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          data-state={activeTab === tab.id ? "active" : "inactive"}
          className={cn(tabVariants({ variant }), tabClassName)}
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
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({
  id,
  activeTab,
  children,
  className,
}) => {
  if (id !== activeTab) return null;

  return (
    <div className={cn("py-4 focus-visible:outline-none", className)}>
      {children}
    </div>
  );
};
