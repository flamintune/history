import React from 'react';
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
}

export const StatCard: React.FC<StatCardProps> = ({ icon: Icon, title, value }) => {
  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="flex items-center text-sm font-medium text-muted-foreground">
          <Icon className="h-4 w-4 mr-2" />
          {title}
        </CardTitle>
        <p className="text-2xl font-bold">{value}</p>
      </CardHeader>
    </Card>
  );
};