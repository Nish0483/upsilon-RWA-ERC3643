import { formatUsd } from "@/lib/api";
import { Building2, Users, TrendingUp, DollarSign } from "lucide-react";

interface StatsProps {
  stats: {
    totalProperties: number;
    totalValue: number;
    activeOfferings: number;
    totalInvestors: number;
    avgYield: number;
  };
}

const items = [
  { key: "totalValue", label: "Total AUM", icon: DollarSign, format: (v: number) => formatUsd(v) },
  { key: "totalProperties", label: "Properties", icon: Building2, format: (v: number) => String(v) },
  { key: "totalInvestors", label: "Investors", icon: Users, format: (v: number) => v.toLocaleString() },
  { key: "avgYield", label: "Avg Yield", icon: TrendingUp, format: (v: number) => `${v}%` },
] as const;

export function StatsBar({ stats }: StatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map(({ key, label, icon: Icon, format }) => (
        <div key={key} className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="text-lg font-semibold text-zinc-100">
              {format(stats[key as keyof typeof stats] as number)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
