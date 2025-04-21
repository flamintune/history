import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// 注册Chart.js组件
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
  type?: "hourly" | "daily";
}

export const ActivityChart: React.FC<ActivityChartProps> = ({
  data,
  type = "hourly",
}) => {
  const prepareChartData = () => {
    if (type === "hourly") {
      // 小时数据处理
      const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
      const values = labels.map((_, i) => data[i] || 0);

      return {
        labels,
        datasets: [
          {
            label: "Number of Visits",
            data: values,
            backgroundColor: "rgba(53, 162, 235, 0.5)",
          },
        ],
      };
    } else {
      // 每日数据处理
      const sortedDates = Object.keys(data).sort();
      const formattedLabels = sortedDates.map((date) =>
        new Date(date).toLocaleDateString()
      );
      const values = sortedDates.map((date) => data[date]);

      return {
        labels: formattedLabels,
        datasets: [
          {
            label: "Number of Visits",
            data: values,
            backgroundColor: "rgba(53, 162, 235, 0.5)",
          },
        ],
      };
    }
  };

  const chartData = prepareChartData();

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: type === "hourly" ? "Hourly Activity" : "Daily Activity",
      },
    },
  };

  return <Bar data={chartData} options={options} />;
};
