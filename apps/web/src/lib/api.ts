import { fallbackProperties, fallbackStats } from "./fallback-data";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface Property {
  id: string;
  slug: string;
  name: string;
  location: string;
  type: string;
  totalValue: number;
  tokenSymbol: string;
  tokenPrice: number;
  totalSupply: number;
  availableTokens: number;
  expectedYield: number;
  image: string;
  description: string;
  features: string[];
  status: "active" | "funded" | "pending";
  contractAddress?: string;
}

export interface PlatformStats {
  totalProperties: number;
  totalValue: number;
  activeOfferings: number;
  totalInvestors: number;
  avgYield: number;
}

export interface KycRecord {
  id?: string;
  status: "none" | "pending" | "approved" | "rejected";
  walletAddress?: string;
  fullName?: string;
  submittedAt?: string;
}

export async function fetchProperties(): Promise<Property[]> {
  try {
    const res = await fetch(`${API_URL}/api/properties`, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error("Failed to fetch properties");
    return res.json();
  } catch {
    return fallbackProperties;
  }
}

export async function fetchProperty(slug: string): Promise<Property> {
  try {
    const res = await fetch(`${API_URL}/api/properties/${slug}`, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error("Property not found");
    return res.json();
  } catch {
    const property = fallbackProperties.find((p) => p.slug === slug);
    if (!property) throw new Error("Property not found");
    return property;
  }
}

export async function fetchStats(): Promise<PlatformStats> {
  try {
    const res = await fetch(`${API_URL}/api/stats`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
  } catch {
    return fallbackStats;
  }
}

export async function fetchKyc(wallet: string): Promise<KycRecord> {
  const res = await fetch(`${API_URL}/api/kyc/${wallet}`);
  if (!res.ok) throw new Error("Failed to fetch KYC status");
  return res.json();
}

export async function submitKyc(data: {
  walletAddress: string;
  fullName: string;
  email: string;
  country: string;
  countryCode: number;
}): Promise<KycRecord> {
  const res = await fetch(`${API_URL}/api/kyc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "KYC submission failed");
  }
  return res.json();
}

export async function verifyKyc(walletAddress: string, countryCode = 356): Promise<KycRecord> {
  const res = await fetch(`${API_URL}/api/kyc/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, countryCode }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "KYC verification failed");
  }
  return res.json();
}

export interface Investment {
  id: string;
  propertyId: string;
  walletAddress: string;
  tokenAmount: number;
  usdValue: number;
  txHash?: string;
  createdAt: string;
}

export async function createInvestment(data: {
  propertyId: string;
  walletAddress: string;
  tokenAmount: number;
  usdValue: number;
}): Promise<Investment> {
  const res = await fetch(`${API_URL}/api/investments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Investment failed");
  }
  return res.json();
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
