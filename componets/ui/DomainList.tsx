import React from "react";

interface DomainListProps {
  domains: Array<{ domain: string; visits: number }>;
}

export const DomainList: React.FC<DomainListProps> = ({ domains }) => {
  return (
    <div className="domain-list">
      {domains.map((domain, index) => (
        <div key={index} className="domain-item">
          <div className="domain-name">{domain.domain}</div>
          <div className="domain-visits">{domain.visits} visits</div>
        </div>
      ))}
    </div>
  );
};
