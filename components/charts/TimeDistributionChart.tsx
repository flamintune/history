import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
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

interface TimeDistributionChartProps {
  data: TimeDistributionData;
  title: string;
  formatValue?: (value: number) => string;
  height?: number;
}

export const TimeDistributionChart: React.FC<TimeDistributionChartProps> = ({
  data,
  title,
  formatValue,
  height = 200
}) => {
  const chartData = {
    labels: data.labels,
    datasets: [
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
        display: false,
      },
      tooltip: {
        backgroundColor: 'hsl(var(--popover))',
        titleColor: 'hsl(var(--popover-foreground))',
        bodyColor: 'hsl(var(--popover-foreground))',
        borderColor: 'hsl(var(--border))',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            const value = context.raw;
            return formatValue ? formatValue(value) : `${value}`;
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