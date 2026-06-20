"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useIdentityVerified } from "@/hooks/useIdentityVerified";

export function IdentityGate({ action = "invest" }: { action?: string }) {
  const { isConnected, isWrongChain, isVerified, isLoading, targetChainId, refetch } =
    useIdentityVerified();

  if (!isConnected) {
    return (
      <p className="text-xs text-amber-400/80 text-center">Connect wallet to {action}</p>
    );
  }

  if (isWrongChain) {
    return (
      <p className="text-xs text-amber-400/80 text-center flex items-center justify-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        Switch MetaMask to Sepolia (chain {targetChainId})
      </p>
    );
  }

  if (isLoading) {
    return <p className="text-xs text-zinc-500 text-center">Checking on-chain identity…</p>;
  }

  if (!isVerified) {
    return (
      <div className="text-center space-y-2">
        <p className="text-xs text-amber-400/80">
          <Link href="/kyc" className="underline hover:text-amber-300">
            Complete KYC
          </Link>{" "}
          to {action}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Refresh status
        </button>
      </div>
    );
  }

  return null;
}
