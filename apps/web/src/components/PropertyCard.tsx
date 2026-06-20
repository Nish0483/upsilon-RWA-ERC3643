import Link from "next/link";
import Image from "next/image";
import { MapPin, TrendingUp, ArrowUpRight } from "lucide-react";
import { Property, formatUsd } from "@/lib/api";
import clsx from "clsx";

const statusStyles = {
  active: "bg-emerald-400/10 text-emerald-400",
  funded: "bg-zinc-500/10 text-zinc-400",
  pending: "bg-amber-400/10 text-amber-400",
};

export function PropertyCard({ property }: { property: Property }) {
  const funded = ((property.totalSupply - property.availableTokens) / property.totalSupply) * 100;

  return (
    <Link href={`/properties/${property.slug}`} className="group block">
      <article className="glass rounded-2xl overflow-hidden hover:border-accent/30 transition-all duration-300 animate-slide-up">
        <div className="relative h-48 overflow-hidden">
          <Image
            src={property.image}
            alt={property.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
          <span className={clsx("badge absolute top-4 left-4 capitalize", statusStyles[property.status])}>
            {property.status}
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-zinc-100 group-hover:text-accent transition-colors">
                {property.name}
              </h3>
              <p className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                <MapPin className="w-3 h-3" />
                {property.location}
              </p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-accent transition-colors shrink-0 mt-1" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-zinc-500">Total Value</p>
              <p className="text-sm font-medium text-zinc-200">{formatUsd(property.totalValue)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Expected Yield</p>
              <p className="text-sm font-medium text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                {property.expectedYield}%
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
              <span>Funded</span>
              <span>{funded.toFixed(0)}%</span>
            </div>
            <div className="h-1 rounded-full bg-surface-overlay overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${funded}%` }}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-500">${property.tokenPrice}/token</span>
            <span className="text-xs font-mono text-accent">{property.tokenSymbol}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
