import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface ActivityChartProps {
  data: Record<string | number, number>;
}

export const ActivityChart: React.FC<ActivityChartProps> = ({ data }) => {
  const labels = Object.keys(data).map((key) => {
    if (typeof key === "number") {
      return `${key}:00`;
    }
    return key;
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: "Visits",
        data: Object.values(data),
        backgroundColor: "hsl(var(--primary))",
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
        backgroundColor: "hsl(var(--popover))",
        titleColor: "hsl(var(--popover-foreground))",
        bodyColor: "hsl(var(--popover-foreground))",
        borderColor: "hsl(var(--border))",
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "hsl(var(--border))",
        },
        ticks: {
          color: "hsl(var(--muted-foreground))",
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: "hsl(var(--muted-foreground))",
        },
      },
    },
  };

  return (
    <div className="h-[200px] w-full">
      <Bar data={chartData} options={options} />
    </div>
  );
};
