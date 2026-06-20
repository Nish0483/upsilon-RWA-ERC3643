import { ethers } from "ethers";
import TREX from "@erc3643org/erc-3643";
import OnchainID from "@onchain-id/solidity";
import deployments from "../deployments.json";

const KYC_CLAIM_TOPIC = 1n;

// Generous gas caps so we can submit all three txs up front without calling
// eth_estimateGas (which would revert for addClaim/register before the identity
// contract is mined). You only pay for gas actually used, not the cap.
const CREATE_GAS = 1_200_000n;
const CLAIM_GAS = 600_000n;
const REGISTER_GAS = 500_000n;

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

  const managementKey = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address"], [agentAddress])
  );

  // ── Fast path: brand-new identity ──────────────────────────────────────
  // Submit create + addClaim + registerIdentity together with consecutive
  // nonces. The EVM executes a wallet's txs in nonce order, so they resolve in
  // sequence within one or two blocks instead of waiting a block per step.
  if (identityAddress === ethers.ZeroAddress) {
    const fees = await bumpedFees();
    const startNonce = await agent.getNonce("pending");

    // Predict the deterministic identity address (static call — no tx).
    identityAddress = walletIsAgent
      ? await idFactory.createIdentity.staticCall(walletAddress, salt)
      : await idFactory.createIdentityWithManagementKeys.staticCall(walletAddress, salt, [managementKey]);

    const identity = new ethers.Contract(identityAddress, OnchainID.contracts.Identity.abi, agent);
    const { signature, claimData } = await buildClaimSignature(identityAddress, claimSigner);

    const createTx = walletIsAgent
      ? await idFactory.createIdentity(walletAddress, salt, {
          ...fees,
          nonce: startNonce,
          gasLimit: CREATE_GAS,
        })
      : await idFactory.createIdentityWithManagementKeys(walletAddress, salt, [managementKey], {
          ...fees,
          nonce: startNonce,
          gasLimit: CREATE_GAS,
        });

    const claimTx = await identity.addClaim(
      KYC_CLAIM_TOPIC,
      1,
      deployments.claimIssuer,
      signature,
      claimData,
      "",
      { ...fees, nonce: startNonce + 1, gasLimit: CLAIM_GAS }
    );

    const registerTx = await identityRegistry.registerIdentity(walletAddress, identityAddress, countryCode, {
      ...fees,
      nonce: startNonce + 2,
      gasLimit: REGISTER_GAS,
    });

    await Promise.all([createTx.wait(), claimTx.wait(), registerTx.wait()]);

    if (!(await isVerifiedOnChain(walletAddress))) {
      throw new Error("On-chain identity registration failed");
    }
    return { identityAddress, alreadyVerified: false };
  }

  // ── Slow path: identity already exists (created/registered earlier) ─────
  // Finish whatever step is missing. These can still be batched together.
  const identity = new ethers.Contract(identityAddress, OnchainID.contracts.Identity.abi, agent);
  const needsClaim = (await identity.getClaimIdsByTopic(KYC_CLAIM_TOPIC)).length === 0;

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
