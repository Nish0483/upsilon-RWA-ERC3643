import Link from "next/link";
import { ArrowRight, Shield, Layers, Zap } from "lucide-react";
import { fetchProperties, fetchStats } from "@/lib/api";
import { PropertyCard } from "@/components/PropertyCard";
import { StatsBar } from "@/components/StatsBar";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [properties, stats] = await Promise.all([fetchProperties(), fetchStats()]);
  const featured = properties.filter((p) => p.status === "active").slice(0, 3);

  return (
    <div className="max-w-6xl mx-auto px-6">
      {/* Hero */}
      <section className="py-24 md:py-32">
        <div className="max-w-2xl animate-slide-up">
          <p className="text-accent text-sm font-medium tracking-wide uppercase mb-4">
            ERC-3643 Compliant
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-50 leading-[1.1]">
            Own real estate.
            <br />
            <span className="text-zinc-500">On-chain.</span>
          </h1>
          <p className="mt-6 text-lg text-zinc-400 leading-relaxed max-w-lg">
            Fractional ownership of institutional-grade properties through regulated
            security tokens. KYC-verified. Compliance-enforced. Transparent.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/properties" className="btn-primary">
              Browse Properties
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/kyc" className="btn-ghost border border-surface-border">
              Complete KYC
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="pb-16">
        <StatsBar stats={stats} />
      </section>

      {/* Features */}
      <section className="py-16 border-t border-surface-border">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-8">
          Why Upsilon
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Shield,
              title: "Regulatory Compliance",
              desc: "ERC-3643 security tokens enforce KYC/AML at the smart contract level. Transfers only between verified identities.",
            },
            {
              icon: Layers,
              title: "Fractional Access",
              desc: "Invest from $50 in premium real estate. Diversify across residential, commercial, and mixed-use assets.",
            },
            {
              icon: Zap,
              title: "Instant Settlement",
              desc: "On-chain ownership with quarterly dividend distributions. Full transparency via blockchain audit trail.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Icon className="w-4 h-4 text-accent" />
              </div>
              <h3 className="font-medium text-zinc-100 mb-2">{title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-16 border-t border-surface-border">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold text-zinc-100">Active Offerings</h2>
          <Link href="/properties" className="btn-ghost text-accent">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {featured.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-surface-border text-center">
        <p className="text-xs text-zinc-600">
          Upsilon · ERC-3643 Real World Assets
        </p>
      </footer>
    </div>
  );
}
