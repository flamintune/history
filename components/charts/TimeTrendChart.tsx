import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TimeDistributionData } from '@/lib/page-view-analyzer';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TimeTrendChartProps {
  data: TimeDistributionData;
  title: string;
  formatValue?: (value: number) => string;
  height?: number;
}

export const TimeTrendChart: React.FC<TimeTrendChartProps> = ({
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
        borderColor: 'hsl(var(--primary))',
        backgroundColor: 'hsla(var(--primary), 0.2)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'hsl(var(--primary))',
        pointBorderColor: 'hsl(var(--background))',
        pointBorderWidth: 1,
        pointRadius: 3,
        pointHoverRadius: 5,
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
      <Line data={chartData} options={options} />
    </div>
  );
};