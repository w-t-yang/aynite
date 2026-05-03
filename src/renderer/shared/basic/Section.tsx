import React from 'react';

interface SectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function Section({ title, description, icon, children, action }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-lg font-medium">{title}</h3>
        </div>
        {action && <div>{action}</div>}
      </div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
