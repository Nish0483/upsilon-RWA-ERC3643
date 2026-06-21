import deployments from "./deployments.json";
import { parseEther, formatEther } from "viem";

export const TOKEN_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "paused",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const IDENTITY_REGISTRY_ABI = [
  {
    inputs: [{ name: "_userAddress", type: "address" }],
    name: "isVerified",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Shared sale contract that handles every property token; each call is keyed
// by the token address.
export const MULTI_PROPERTY_SALE_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "tokenAmount", type: "uint256" },
    ],
    name: "buy",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "token", type: "address" }],
    name: "tokensAvailable",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "token", type: "address" }],
    name: "tokenPriceWei",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export { deployments };

const ZERO = "0x0000000000000000000000000000000000000000";

export interface OnChainProperty {
  token: string;
  sale: string;
  priceWei: bigint;
}

/**
 * Maps a property slug to its on-chain token + the shared sale contract, or
 * null if the property isn't backed by a deployed token (purchasing disabled).
 */
export function getOnChainProperty(slug: string): OnChainProperty | null {
  if (deployments.identityRegistry === ZERO || deployments.multiSale === ZERO) return null;

  if (slug === "koramangala-skyrise" && deployments.token !== ZERO) {
    return {
      token: deployments.token,
      sale: deployments.multiSale,
      priceWei: BigInt(deployments.tokenPriceWei || parseEther("0.01").toString()),
    };
  }

  if (slug === deployments.secondaryTokenSlug && deployments.secondaryToken !== ZERO) {
    return {
      token: deployments.secondaryToken,
      sale: deployments.multiSale,
      priceWei: BigInt(deployments.secondaryTokenPriceWei || parseEther("0.01").toString()),
    };
  }

  return null;
}

export function calcEthCost(tokenAmount: number, priceWei?: bigint): bigint {
  if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) return BigInt(0);
  const price = priceWei ?? BigInt(deployments.tokenPriceWei || parseEther("0.01").toString());
  // Match on-chain: (tokenAmountWei * tokenPriceWei) / 1e18
  return (parseEther(String(tokenAmount)) * price) / BigInt(10 ** 18);
}

export function tokenPriceEth(priceWei?: bigint): bigint {
  return priceWei ?? BigInt(deployments.tokenPriceWei || parseEther("0.01").toString());
}

export function formatEth(wei: bigint): string {
  const value = Number(formatEther(wei));
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function isTrexDeployed(): boolean {
  return (
    deployments.token !== ZERO &&
    deployments.propertySale !== ZERO &&
    deployments.identityRegistry !== ZERO
  );
}
