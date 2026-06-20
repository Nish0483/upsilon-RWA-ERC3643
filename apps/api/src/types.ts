export interface Property {
  id: string;
  slug: string;
  name: string;
  location: string;
  type: "residential" | "commercial" | "mixed";
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
  createdAt: string;
}

export interface KycRequest {
  id: string;
  walletAddress: string;
  fullName: string;
  email: string;
  country: string;
  countryCode: number;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt?: string;
  txHash?: string;
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
