import { ethers } from "ethers";
import TREX from "@erc3643org/erc-3643";
import OnchainID from "@onchain-id/solidity";
import deployments from "../deployments.json";

const KYC_CLAIM_TOPIC = 1n;

async function confirmTx(tx: ethers.ContractTransactionResponse): Promise<void> {
  await tx.wait();
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required — set it in apps/api/.env.local`);
  }
  return value;
}

function getProvider() {
  return new ethers.JsonRpcProvider(requireEnv("RPC_URL"));
}

function getAgentSigner() {
  const privateKey = requireEnv("DEPLOYER_PRIVATE_KEY");
  return new ethers.Wallet(privateKey, getProvider());
}

function getClaimSigner() {
  const key = requireEnv("CLAIM_ISSUER_SIGNING_KEY");
  return new ethers.Wallet(key, getProvider());
}

export async function isVerifiedOnChain(walletAddress: string): Promise<boolean> {
  if (!deployments.identityRegistry || deployments.identityRegistry === ethers.ZeroAddress) {
    return false;
  }
  const registry = new ethers.Contract(
    deployments.identityRegistry,
    TREX.contracts.IdentityRegistry.abi,
    getProvider()
  );
  return registry.isVerified(walletAddress);
}

async function addKycClaimIfNeeded(
  identity: ethers.Contract,
  identityAddress: string,
  claimSigner: ethers.Wallet
): Promise<void> {
  const claimIds: string[] = await identity.getClaimIdsByTopic(KYC_CLAIM_TOPIC);
  if (claimIds.length > 0) return;

  const claimData = ethers.hexlify(ethers.toUtf8Bytes("KYC approved (demo)"));
  const dataHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes"],
      [identityAddress, KYC_CLAIM_TOPIC, claimData]
    )
  );
  const signature = await claimSigner.signMessage(ethers.getBytes(dataHash));
  await confirmTx(
    await identity.addClaim(KYC_CLAIM_TOPIC, 1, deployments.claimIssuer, signature, claimData, "")
  );
}

export async function registerIdentityOnChain(
  walletAddress: string,
  countryCode = 356
): Promise<{ identityAddress: string; alreadyVerified: boolean }> {
  if (!deployments.identityFactory || !deployments.identityRegistry) {
    throw new Error("T-REX not deployed — run npm run deploy:sepolia");
  }

  const already = await isVerifiedOnChain(walletAddress);
  if (already) return { identityAddress: "", alreadyVerified: true };

  const agent = getAgentSigner();
  const claimSigner = getClaimSigner();

  const idFactory = new ethers.Contract(
    deployments.identityFactory,
    OnchainID.contracts.Factory.abi,
    agent
  );
  const identityRegistry = new ethers.Contract(
    deployments.identityRegistry,
    TREX.contracts.IdentityRegistry.abi,
    agent
  );

  const salt = `kyc-${walletAddress.toLowerCase().slice(2, 10)}`;
  const agentAddress = await agent.getAddress();
  const walletIsAgent = walletAddress.toLowerCase() === agentAddress.toLowerCase();

  let identityAddress = await identityRegistry.identity(walletAddress);
  const needsRegistry = identityAddress === ethers.ZeroAddress;

  if (needsRegistry) {
    identityAddress = await idFactory.getIdentity(walletAddress);
  }

  if (identityAddress === ethers.ZeroAddress) {
    if (walletIsAgent) {
      identityAddress = await idFactory.createIdentity.staticCall(walletAddress, salt);
      await confirmTx(await idFactory.createIdentity(walletAddress, salt));
    } else {
      const managementKey = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["address"], [agentAddress])
      );
      identityAddress = await idFactory.createIdentityWithManagementKeys.staticCall(
        walletAddress,
        salt,
        [managementKey]
      );
      await confirmTx(
        await idFactory.createIdentityWithManagementKeys(walletAddress, salt, [managementKey])
      );
    }
  }

  const identity = new ethers.Contract(
    identityAddress,
    OnchainID.contracts.Identity.abi,
    agent
  );

  await addKycClaimIfNeeded(identity, identityAddress, claimSigner);

  if (needsRegistry) {
    await confirmTx(
      await identityRegistry.registerIdentity(walletAddress, identityAddress, countryCode)
    );
  }

  if (!(await isVerifiedOnChain(walletAddress))) {
    throw new Error("On-chain identity registration failed");
  }

  return { identityAddress, alreadyVerified: false };
}
