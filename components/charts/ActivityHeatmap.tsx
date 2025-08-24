import React, { useMemo } from 'react';
import { TimeDistributionData } from '@/lib/page-view-analyzer';

interface ActivityHeatmapProps {
  data: TimeDistributionData;
  title: string;
  formatValue?: (value: number) => string;
  height?: number;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  data,
  title,
  formatValue,
  height = 300
}) => {
  // Extract datasets from the data
  const dayLabels = data.datasets?.map(d => d.label) || [];
  const hourLabels = data.labels || [];
  
  // Create a 2D array of values [day][hour]
  const heatmapValues = useMemo(() => {
    if (!data.datasets) return [];
    return data.datasets.map(dataset => dataset.data);
  }, [data.datasets]);
  
  // Find the maximum value for color scaling
  const maxValue = useMemo(() => {
    if (!heatmapValues.length) return 0;
    return Math.max(...heatmapValues.flat());
  }, [heatmapValues]);
  
  // Generate color for a cell based on its value
  const getCellColor = (value: number) => {
    if (value === 0) return 'bg-gray-100 dark:bg-gray-800';
    
    // Calculate intensity (0-1)
    const intensity = Math.min(value / maxValue, 1);
    
    // Use a blue gradient for intensity
    if (intensity < 0.2) return 'bg-blue-100 dark:bg-blue-900/30';
    if (intensity < 0.4) return 'bg-blue-200 dark:bg-blue-800/40';
    if (intensity < 0.6) return 'bg-blue-300 dark:bg-blue-700/50';
    if (intensity < 0.8) return 'bg-blue-400 dark:bg-blue-600/60';
    return 'bg-blue-500 dark:bg-blue-500/70';
  };

  if (!data.datasets || !data.labels) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No data available for heatmap</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: `${height}px` }}>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      
      <div className="flex flex-col h-full">
        {/* Hour labels (top) */}
        <div className="flex border-b">
          <div className="w-20 flex-shrink-0"></div>
          <div className="flex-1 flex">
            {hourLabels.map((hour, i) => (
              <div 
                key={`hour-${i}`} 
                className="flex-1 text-center text-xs text-muted-foreground py-1"
                style={{ minWidth: '20px' }}
              >
                {i % 3 === 0 ? hour : ''}
              </div>
            ))}
          </div>
        </div>
        
        {/* Heatmap grid */}
        <div className="flex-1 overflow-y-auto">
          {dayLabels.map((day, dayIndex) => (
            <div key={`day-${dayIndex}`} className="flex border-b last:border-b-0">
              {/* Day label */}
              <div className="w-20 flex-shrink-0 text-xs text-muted-foreground flex items-center px-2">
                {day}
              </div>
              
              {/* Hour cells */}
              <div className="flex-1 flex">
                {heatmapValues[dayIndex]?.map((value, hourIndex) => (
                  <div
                    key={`cell-${dayIndex}-${hourIndex}`}
                    className={`flex-1 h-8 border-r last:border-r-0 ${getCellColor(value)} transition-colors`}
                    style={{ minWidth: '20px' }}
                    title={`${day}, ${hourLabels[hourIndex]}: ${formatValue ? formatValue(value) : value}`}
                  ></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};