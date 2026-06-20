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

export const PROPERTY_SALE_ABI = [
  {
    inputs: [{ name: "tokenAmount", type: "uint256" }],
    name: "buy",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "tokensAvailable",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "tokenPriceWei",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export { deployments };

const ZERO = "0x0000000000000000000000000000000000000000";

export function calcEthCost(tokenAmount: number): bigint {
  if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) return 0n;
  const price = BigInt(deployments.tokenPriceWei || parseEther("0.01").toString());
  // Match on-chain: (tokenAmountWei * tokenPriceWei) / 1e18
  return (parseEther(String(tokenAmount)) * price) / BigInt(10 ** 18);
}

export function tokenPriceEth(): bigint {
  return BigInt(deployments.tokenPriceWei || parseEther("0.01").toString());
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
