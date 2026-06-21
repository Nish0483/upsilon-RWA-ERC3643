"use client";

import { useAccount, useReadContracts } from "wagmi";
import { Wallet, ShieldCheck, ShieldX, Coins } from "lucide-react";
import Link from "next/link";
import deployments from "@/lib/deployments.json";
import { TOKEN_ABI } from "@/lib/contracts";
import { formatNumber } from "@/lib/api";
import { fallbackProperties } from "@/lib/fallback-data";
import { formatEther } from "viem";
import { useIdentityVerified } from "@/hooks/useIdentityVerified";

const ZERO = "0x0000000000000000000000000000000000000000";

// Every deployed property token, paired with catalog metadata (name + USD price).
const tokenDefs = [
  { address: deployments.token, symbol: deployments.tokenSymbol, name: deployments.tokenName },
  {
    address: deployments.secondaryToken,
    symbol: deployments.secondaryTokenSymbol,
    name: deployments.secondaryTokenName,
  },
].filter((t) => t.address && t.address !== ZERO);

const usdPriceBySymbol: Record<string, number> = Object.fromEntries(
  fallbackProperties.map((p) => [p.tokenSymbol, p.tokenPrice])
);

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { isVerified, isWrongChain, targetChainId } = useIdentityVerified();

  const { data: balances } = useReadContracts({
    contracts: tokenDefs.map((t) => ({
      address: t.address as `0x${string}`,
      abi: TOKEN_ABI,
      functionName: "balanceOf",
      args: address ? [address as `0x${string}`] : undefined,
      chainId: deployments.chainId,
    })),
    query: { enabled: !!address && !isWrongChain },
  });

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-24 text-center">
        <Wallet className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-zinc-300">Connect your wallet</h1>
        <p className="text-sm text-zinc-500 mt-2">View your tokenized real estate holdings</p>
      </div>
    );
  }

  const holdings = tokenDefs.map((t, i) => {
    const raw = balances?.[i]?.result as bigint | undefined;
    const balance = raw ? Number(formatEther(raw)) : 0;
    const usd = (usdPriceBySymbol[t.symbol] ?? 0) * balance;
    return { ...t, balance, usd };
  });

  const owned = holdings.filter((h) => h.balance > 0);
  const totalValue = holdings.reduce((sum, h) => sum + h.usd, 0);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Portfolio</h1>
      <p className="text-sm text-zinc-500 mb-8 font-mono">{address}</p>

      {isWrongChain && (
        <p className="text-sm text-amber-400 mb-6">
          Switch to Sepolia (chain {targetChainId}) to view on-chain data.
        </p>
      )}

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <p className="text-xs text-zinc-500 mb-1">Total Value</p>
          <p className="text-2xl font-bold text-zinc-100">${formatNumber(totalValue)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-zinc-500 mb-1">Properties Held</p>
          <p className="text-2xl font-bold font-mono text-accent">{owned.length}</p>
        </div>
        <div className="card flex items-center gap-3">
          {isVerified ? (
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          ) : (
            <ShieldX className="w-8 h-8 text-amber-400" />
          )}
          <div>
            <p className="text-xs text-zinc-500">Identity Status</p>
            <p className={`text-sm font-medium ${isVerified ? "text-emerald-400" : "text-amber-400"}`}>
              {isWrongChain ? "Wrong network" : isVerified ? "Verified" : "Not Verified"}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="w-4 h-4 text-accent" />
          <h2 className="font-medium text-zinc-200">Holdings</h2>
        </div>

        {owned.length > 0 ? (
          owned.map((h) => (
            <div
              key={h.address}
              className="flex items-center justify-between py-3 border-b border-surface-border last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-zinc-200">{h.name}</p>
                <p className="text-xs text-zinc-500 font-mono">{h.symbol}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-zinc-200">{formatNumber(h.balance)}</p>
                <p className="text-xs text-zinc-500">${formatNumber(h.usd)}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500 py-4 text-center">
            No holdings yet.{" "}
            <Link href="/properties" className="text-accent hover:underline">
              Browse properties
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
