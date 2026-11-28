"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * StatsCard - A statistics card for dashboard metrics
 * Based on 21st.dev Statistics Card patterns (ids: 4245, 4435, 4237)
 */
interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
}

export function StatsCard({
  title,
  value,
  description,
  trend,
  icon,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 transition-all hover:shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 ml-4 text-muted-foreground">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1">
          <span
            className={cn(
              "text-sm font-medium",
              trend.positive ? "text-success" : "text-destructive"
            )}
          >
            {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
          <span className="text-sm text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

/**
 * StatsBento - A responsive bento-grid stats section
 * Based on 21st.dev Stats Bento pattern (id: 25311)
 */
interface StatsBentoProps {
  stats: Array<{
    title: string;
    value: string | number;
    description?: string;
    icon?: React.ReactNode;
    trend?: {
      value: number;
      label: string;
      positive?: boolean;
    };
    className?: string;
  }>;
  className?: string;
}

export function StatsBento({ stats, className }: StatsBentoProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {stats.map((stat, index) => (
        <StatsCard key={index} {...stat} />
      ))}
    </div>
  );
}

/**
 * StatCard - Alternative stat card with icon on left
 * Based on 21st.dev Statistics Card patterns
 */
interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendPositive = true,
  className,
}: StatCardProps) {
  return (
    <div className={cn("flex items-center gap-4 p-4 rounded-xl border border-border bg-card", className)}>
      {icon && (
        <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted-foreground truncate">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        {trend && (
          <p className={cn("text-xs font-medium", trendPositive ? "text-success" : "text-destructive")}>
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}