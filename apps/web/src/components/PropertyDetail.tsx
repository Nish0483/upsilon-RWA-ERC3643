"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  MapPin,
  TrendingUp,
  Shield,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { Property, formatUsd, formatNumber } from "@/lib/api";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { useIdentityVerified } from "@/hooks/useIdentityVerified";
import { IdentityGate } from "@/components/IdentityGate";
import {
  deployments,
  PROPERTY_SALE_ABI,
  calcEthCost,
  formatEth,
  isTrexDeployed,
  tokenPriceEth,
} from "@/lib/contracts";

type Step = "idle" | "buy" | "success" | "error";

export function PropertyDetail({ property }: { property: Property }) {
  const { address, isConnected } = useAccount();
  const { isVerified, isWrongChain } = useIdentityVerified();
  const [amount, setAmount] = useState(100);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [pendingBuy, setPendingBuy] = useState(false);

  const onChainEnabled = property.slug === "koramangala-skyrise" && isTrexDeployed();
  const validAmount = Number.isFinite(amount) && amount > 0;
  const tokenAmountWei = validAmount ? parseEther(String(amount)) : BigInt(0);
  const ethCost = calcEthCost(amount);

  const { data: tokensAvailable } = useReadContract({
    address: deployments.propertySale as `0x${string}`,
    abi: PROPERTY_SALE_ABI,
    functionName: "tokensAvailable",
    chainId: deployments.chainId,
    query: { enabled: onChainEnabled },
  });

  const { writeContract, data: writeHash, isPending: isWritePending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: writeHash,
  });

  const available = tokensAvailable ? Number(tokensAvailable) / 1e18 : property.availableTokens;
  const funded =
    tokensAvailable !== undefined
      ? ((property.totalSupply - available) / property.totalSupply) * 100
      : ((property.totalSupply - property.availableTokens) / property.totalSupply) * 100;

  const canInvest =
    property.status === "active" &&
    isConnected &&
    isVerified &&
    !isWrongChain &&
    onChainEnabled &&
    validAmount &&
    amount <= available &&
    step !== "success";

  useEffect(() => {
    if (!isConfirmed || !pendingBuy) return;
    setTxHash(writeHash ?? null);
    setStep("success");
    setPendingBuy(false);
    reset();
  }, [isConfirmed, pendingBuy, writeHash, reset]);

  function handleBuy() {
    if (!canInvest) return;
    setError(null);
    setStep("buy");
    setPendingBuy(true);
    writeContract({
      address: deployments.propertySale as `0x${string}`,
      abi: PROPERTY_SALE_ABI,
      functionName: "buy",
      args: [tokenAmountWei],
      value: ethCost,
      chainId: deployments.chainId,
    });
  }

  const isBusy = isWritePending || isConfirming || step === "buy";

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <Link href="/properties" className="btn-ghost mb-8 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden">
            <Image
              src={property.image}
              alt={property.name}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
          </div>

          <div className="card">
            <h1 className="text-2xl font-bold text-zinc-100">{property.name}</h1>
            <p className="flex items-center gap-1.5 text-sm text-zinc-500 mt-1">
              <MapPin className="w-3.5 h-3.5" />
              {property.location} · {property.type}
            </p>
            <p className="mt-4 text-sm text-zinc-400 leading-relaxed">{property.description}</p>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-accent" />
              <h3 className="font-medium text-zinc-200">Official ERC-3643 (T-REX) flow</h3>
            </div>
            <ol className="text-sm text-zinc-500 space-y-2 list-decimal list-inside">
              <li>KYC → ONCHAINID claim + Identity Registry (demo issuer)</li>
              <li>Pay native ETH to treasury</li>
              <li>Receive {property.tokenSymbol} via official T-REX token contract</li>
              <li>Compliance enforced on every transfer</li>
            </ol>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card sticky top-24 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500">Total Value</p>
                <p className="text-lg font-semibold">{formatUsd(property.totalValue)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Yield</p>
                <p className="text-lg font-semibold text-emerald-400 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  {property.expectedYield}%
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Token Price</p>
                <p className="text-lg font-semibold">{formatEth(tokenPriceEth())} ETH</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Symbol</p>
                <p className="text-lg font-semibold font-mono text-accent">{property.tokenSymbol}</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                <span>Funded</span>
                <span>{funded.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-overlay">
                <div className="h-full rounded-full bg-accent" style={{ width: `${funded}%` }} />
              </div>
              <p className="text-xs text-zinc-600 mt-1.5">
                {formatNumber(Math.floor(available))} tokens available
              </p>
            </div>

            {property.status === "active" && (
              <>
                {!onChainEnabled && (
                  <p className="text-xs text-amber-400/80 text-center">
                    Run <code className="font-mono">npm run deploy:local</code> to deploy T-REX suite.
                  </p>
                )}

                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">Token Amount</label>
                  <input
                    type="number"
                    min={0.001}
                    step={0.001}
                    max={available}
                    value={amount}
                    onChange={(e) => {
                      const next = e.target.value === "" ? 0 : Number(e.target.value);
                      setAmount(next);
                    }}
                    disabled={step === "success" || isBusy}
                    className="input-field font-mono"
                  />
                </div>

                <div className="rounded-lg border border-surface-border p-4 space-y-2 text-sm">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">You pay</p>
                  <p className="text-xl font-semibold text-zinc-100">
                    {formatEth(ethCost)} <span className="text-sm font-normal text-zinc-500">ETH</span>
                  </p>
                  <div className="flex items-center gap-2 text-zinc-600">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">You receive</p>
                  <p className="text-xl font-semibold font-mono text-accent">
                    {formatNumber(amount)} {property.tokenSymbol}
                  </p>
                </div>

                <IdentityGate action="invest" />

                {error && <p className="text-xs text-red-400 text-center">{error}</p>}

                {step === "success" && (
                  <div className="rounded-lg bg-emerald-400/10 border border-emerald-400/20 p-4 space-y-2">
                    <p className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Purchase complete
                    </p>
                    <p className="text-xs text-zinc-500">
                      Paid {formatEth(ethCost)} ETH → received {formatNumber(amount)} {property.tokenSymbol}
                    </p>
                    {txHash && (
                      <p className="text-xs font-mono text-zinc-600 truncate">Tx: {txHash}</p>
                    )}
                    <Link href="/portfolio" className="text-xs text-accent hover:underline inline-flex items-center gap-1">
                      View portfolio <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}

                {step !== "success" && onChainEnabled && (
                  <button className="btn-primary w-full" disabled={!canInvest || isBusy} onClick={handleBuy}>
                    {isBusy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Confirm in MetaMask…
                      </>
                    ) : (
                      `Buy ${property.tokenSymbol} with ETH`
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
