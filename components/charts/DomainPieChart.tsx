import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { TimeDistributionData } from '@/lib/page-view-analyzer';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

interface DomainPieChartProps {
  data: TimeDistributionData;
  title: string;
  formatValue?: (value: number) => string;
  height?: number;
}

export const DomainPieChart: React.FC<DomainPieChartProps> = ({
  data,
  title,
  formatValue,
  height = 200
}) => {
  const chartData = {
    labels: data.labels,
    datasets: [
      {
        data: data.values,
        backgroundColor: data.colors,
        borderColor: 'hsl(var(--background))',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          boxWidth: 12,
          padding: 10,
          font: {
            size: 10
          },
          color: 'hsl(var(--foreground))'
        }
      },
      tooltip: {
        backgroundColor: 'hsl(var(--popover))',
        titleColor: 'hsl(var(--popover-foreground))',
        bodyColor: 'hsl(var(--popover-foreground))',
        borderColor: 'hsl(var(--border))',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.raw;
            const formattedValue = formatValue ? formatValue(value) : `${value}`;
            const percentage = Math.round((value / data.values.reduce((a, b) => a + b, 0)) * 100);
            return `${label}: ${formattedValue} (${percentage}%)`;
          }
        }
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 14,
          weight: 'normal'
        },
        color: 'hsl(var(--muted-foreground))',
        padding: {
          bottom: 10
        }
      }
    },
  };

  return (
    <div style={{ height: `${height}px` }} className="w-full">
      <Pie data={chartData} options={options} />
    </div>
  );
};