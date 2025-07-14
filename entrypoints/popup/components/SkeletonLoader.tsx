import React from 'react';

export const SkeletonLoader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[150px] space-y-2">
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
  );
};