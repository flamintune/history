import React from "react";

interface StatsOverviewProps {
  totalVisits: number;
  uniqueDomains: number;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  totalVisits,
  uniqueDomains,
}) => {
  return (
    <div className="stats-overview">
      <div className="stat-box">
        <h3>Total Visits</h3>
        <div className="stat-value">{totalVisits}</div>
      </div>
      <div className="stat-box">
        <h3>Unique Domains</h3>
        <div className="stat-value">{uniqueDomains}</div>
      </div>
    </div>
  );
};
