import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { TimeDistributionData } from '@/lib/page-view-analyzer';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface CategoryBarChartProps {
  data: TimeDistributionData;
  title: string;
  formatValue?: (value: number) => string;
  height?: number;
  stacked?: boolean;
}

export const CategoryBarChart: React.FC<CategoryBarChartProps> = ({
  data,
  title,
  formatValue,
  height = 200,
  stacked = true
}) => {
  const chartData = {
    labels: data.labels,
    datasets: data.datasets || [
      {
        label: title,
        data: data.values,
        backgroundColor: data.colors || 'hsl(var(--primary))',
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: data.datasets ? true : false,
        position: 'top' as const,
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
            const label = context.dataset.label || '';
            const value = context.raw;
            return `${label}: ${formatValue ? formatValue(value) : value}`;
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
    scales: {
      y: {
        beginAtZero: true,
        stacked: stacked,
        grid: {
          color: 'hsl(var(--border))',
        },
        ticks: {
          color: 'hsl(var(--muted-foreground))',
          callback: function(value: any) {
            return formatValue ? formatValue(value) : value;
          }
        },
      },
      x: {
        stacked: stacked,
        grid: {
          display: false,
        },
        ticks: {
          color: 'hsl(var(--muted-foreground))',
          maxRotation: 45,
          minRotation: 0
        },
      },
    },
  };

  return (
    <div style={{ height: `${height}px` }} className="w-full">
      <Bar data={chartData} options={options} />
    </div>
  );
};