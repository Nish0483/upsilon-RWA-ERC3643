"use client";

import { useState, useEffect } from "react";
import { Shield, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { fetchKyc, submitKyc, verifyKyc, KycRecord } from "@/lib/api";
import { useIdentityVerified } from "@/hooks/useIdentityVerified";

const countries = [
  { name: "India", code: 356 },
  { name: "United States", code: 840 },
  { name: "United Kingdom", code: 826 },
  { name: "Germany", code: 276 },
  { name: "Singapore", code: 702 },
];

export default function KycPage() {
  const { address, isConnected, isVerified, isWrongChain, targetChainId, refetch, isLoading } =
    useIdentityVerified();
  const [kyc, setKyc] = useState<KycRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", country: "India", countryCode: 356 });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!address) return;
    fetchKyc(address).then(setKyc).catch(() => setKyc({ status: "none" }));
  }, [address]);

  async function handleQuickVerify() {
    if (!address) return;
    setLoading(true);
    setError("");
    try {
      const record = await verifyKyc(address, form.countryCode);
      setKyc(record);
      await refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    setLoading(true);
    setError("");
    try {
      const record = await submitKyc({ walletAddress: address, ...form });
      setKyc(record);
      await refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <Shield className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-zinc-300">Connect wallet first</h1>
        <p className="text-sm text-zinc-500 mt-2">KYC is tied to your wallet address</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Identity Verification</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Required for ERC-3643 compliant token transfers
        </p>
      </div>

      {isWrongChain && (
        <div className="card flex items-center gap-4 border-amber-400/20 mb-6">
          <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
          <div>
            <p className="font-medium text-amber-400">Wrong network</p>
            <p className="text-sm text-zinc-500 mt-0.5">
              Switch MetaMask to <strong className="text-zinc-300">Sepolia</strong> (chain ID {targetChainId})
              to verify and invest.
            </p>
          </div>
        </div>
      )}

      {isLoading && !isWrongChain && (
        <div className="card text-sm text-zinc-500 mb-6">Checking on-chain identity…</div>
      )}

      {isVerified && !isWrongChain && (
        <div className="card flex items-center gap-4 border-emerald-400/20">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
          <div>
            <p className="font-medium text-emerald-400">Verified on-chain</p>
            <p className="text-sm text-zinc-500 mt-0.5">
              Your wallet is registered in the Identity Registry. You can invest and receive security tokens.
            </p>
          </div>
        </div>
      )}

      {!isVerified && !isWrongChain && !isLoading && (
        <div className="mb-6">
          <button
            type="button"
            onClick={handleQuickVerify}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "Registering on-chain…" : "Verify instantly (test)"}
          </button>
          <p className="text-xs text-zinc-600 text-center mt-2">
            Registers your wallet in the on-chain Identity Registry
          </p>
        </div>
      )}

      {!isVerified && !isWrongChain && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Full Name</label>
            <input
              required
              className="input-field"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Email</label>
            <input
              required
              type="email"
              className="input-field"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jane@example.com"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Country</label>
            <select
              className="input-field"
              value={form.country}
              onChange={(e) => {
                const c = countries.find((c) => c.name === e.target.value)!;
                setForm({ ...form, country: c.name, countryCode: c.code });
              }}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="text-xs text-zinc-600 bg-surface-overlay rounded-lg p-3">
            Wallet: <span className="font-mono text-zinc-400">{address}</span>
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </p>
          )}

          <button type="submit" className="btn-ghost w-full border border-surface-border" disabled={loading}>
            {loading ? "Submitting…" : "Submit KYC form"}
          </button>
        </form>
      )}

      <div className="mt-8 card">
        <h3 className="text-sm font-medium text-zinc-300 mb-2">How it works</h3>
        <ol className="text-xs text-zinc-500 space-y-2 list-decimal list-inside">
          <li>Connect MetaMask on Sepolia (chain {targetChainId})</li>
          <li>Verify — your wallet is registered in the Identity Registry</li>
          <li>ERC-3643 compliance only allows transfers between verified wallets</li>
        </ol>
      </div>
    </div>
  );
}
