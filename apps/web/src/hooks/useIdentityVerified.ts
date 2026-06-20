"use client";

import { useAccount, useReadContract } from "wagmi";
import deployments from "@/lib/deployments.json";
import { IDENTITY_REGISTRY_ABI } from "@/lib/contracts";

const ZERO = "0x0000000000000000000000000000000000000000";

export function useIdentityVerified() {
  const { address, isConnected, chainId } = useAccount();
  const targetChainId = deployments.chainId;
  const isWrongChain = isConnected && chainId !== targetChainId;
  const registryReady =
    !!deployments.identityRegistry && deployments.identityRegistry !== ZERO;

  const { data: isVerified, isLoading, isError, refetch } = useReadContract({
    address: deployments.identityRegistry as `0x${string}`,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "isVerified",
    args: address ? [address] : undefined,
    chainId: targetChainId,
    query: {
      enabled: isConnected && !!address && registryReady && !isWrongChain,
      refetchOnWindowFocus: true,
      staleTime: 5_000,
    },
  });

  return {
    address,
    isConnected,
    chainId,
    targetChainId,
    isWrongChain,
    isVerified: isVerified === true,
    isLoading: isLoading && isConnected && !isWrongChain,
    isError,
    refetch,
    registryReady,
  };
}
