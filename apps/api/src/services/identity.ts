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

let cachedProvider: ethers.JsonRpcProvider | undefined;

function getProvider() {
  if (!cachedProvider) {
    cachedProvider = new ethers.JsonRpcProvider(requireEnv("RPC_URL"));
    // Default is 4000ms — drop it so tx.wait() detects mined receipts faster.
    cachedProvider.pollingInterval = 1000;
  }
  return cachedProvider;
}

// Fetch the live network gas price and pay 1.5x it. A plain legacy gasPrice is
// simpler and more reliable here than EIP-1559 max/priority fees, since public
// nodes report a near-zero suggested tip that leaves txs stuck for many blocks.
const FALLBACK_GAS_PRICE = ethers.parseUnits("2", "gwei");

async function bumpedFees(): Promise<ethers.Overrides> {
  const fee = await getProvider().getFeeData();
  const live = fee.gasPrice ?? FALLBACK_GAS_PRICE;
  return { gasPrice: (live * 3n) / 2n };
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

async function buildClaimSignature(
  identityAddress: string,
  claimSigner: ethers.Wallet
): Promise<{ signature: string; claimData: string }> {
  const claimData = ethers.hexlify(ethers.toUtf8Bytes("KYC approved (demo)"));
  const dataHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes"],
      [identityAddress, KYC_CLAIM_TOPIC, claimData]
    )
  );
  const signature = await claimSigner.signMessage(ethers.getBytes(dataHash));
  return { signature, claimData };
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
    const fees = await bumpedFees();
    if (walletIsAgent) {
      identityAddress = await idFactory.createIdentity.staticCall(walletAddress, salt);
      await confirmTx(await idFactory.createIdentity(walletAddress, salt, fees));
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
        await idFactory.createIdentityWithManagementKeys(walletAddress, salt, [managementKey], fees)
      );
    }
  }

  const identity = new ethers.Contract(
    identityAddress,
    OnchainID.contracts.Identity.abi,
    agent
  );

  // addClaim and registerIdentity both only depend on the identity existing
  // (created above) — not on each other. Send them together with explicit
  // sequential nonces and wait once, saving a full block of latency.
  const needsClaim =
    (await identity.getClaimIdsByTopic(KYC_CLAIM_TOPIC)).length === 0;

  if (needsClaim || needsRegistry) {
    const fees = await bumpedFees();
    let nonce = await agent.getNonce("pending");
    const pending: Promise<void>[] = [];

    if (needsClaim) {
      const { signature, claimData } = await buildClaimSignature(identityAddress, claimSigner);
      pending.push(
        confirmTx(
          await identity.addClaim(KYC_CLAIM_TOPIC, 1, deployments.claimIssuer, signature, claimData, "", {
            ...fees,
            nonce: nonce++,
          })
        )
      );
    }

    if (needsRegistry) {
      pending.push(
        confirmTx(
          await identityRegistry.registerIdentity(walletAddress, identityAddress, countryCode, {
            ...fees,
            nonce: nonce++,
          })
        )
      );
    }

    await Promise.all(pending);
  }

  if (!(await isVerifiedOnChain(walletAddress))) {
    throw new Error("On-chain identity registration failed");
  }

  return { identityAddress, alreadyVerified: false };
}
