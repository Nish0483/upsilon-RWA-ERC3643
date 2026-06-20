import { loadApiEnv } from "./loadEnv";

loadApiEnv();

import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { properties } from "./data/properties";
import { KycRequest, Investment } from "./types";
import { registerIdentityOnChain, isVerifiedOnChain } from "./services/identity";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const kycRequests: KycRequest[] = [];
const investments: Investment[] = [];

// Wallets currently being registered on-chain (prevents duplicate submissions)
const kycInFlight = new Set<string>();

// ─── Properties ───────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "rwa-api" });
});

app.get("/api/properties", (_req, res) => {
  res.json(properties);
});

app.get("/api/properties/:slug", (req, res) => {
  const property = properties.find((p) => p.slug === req.params.slug);
  if (!property) return res.status(404).json({ error: "Property not found" });
  res.json(property);
});

app.get("/api/stats", (_req, res) => {
  const totalValue = properties.reduce((s, p) => s + p.totalValue, 0);
  const active = properties.filter((p) => p.status === "active").length;
  res.json({
    totalProperties: properties.length,
    totalValue,
    activeOfferings: active,
    totalInvestors: 1247,
    avgYield: 7.8,
  });
});

// ─── KYC ──────────────────────────────────────────────────────────

async function approveKyc(record: KycRequest) {
  await registerIdentityOnChain(record.walletAddress, record.countryCode);
  const onChain = await isVerifiedOnChain(record.walletAddress);
  if (!onChain) {
    throw new Error("On-chain identity registration failed");
  }
  record.status = "approved";
  record.reviewedAt = new Date().toISOString();
}

// Kicks off on-chain registration in the background. The frontend polls the
// on-chain `isVerified` to learn when it completes, so we never block the HTTP
// response on the (slow) chain transactions.
function startKycRegistration(record: KycRequest): void {
  const key = record.walletAddress.toLowerCase();
  if (kycInFlight.has(key)) return;
  kycInFlight.add(key);
  record.status = "pending";

  approveKyc(record)
    .catch((err) => {
      record.status = "pending";
      console.error(`KYC on-chain registration failed for ${key}:`, err);
    })
    .finally(() => {
      kycInFlight.delete(key);
    });
}

app.get("/api/kyc/:wallet", async (req, res) => {
  const wallet = req.params.wallet;
  const record = kycRequests.find((k) => k.walletAddress.toLowerCase() === wallet.toLowerCase());

  // If on-chain verified but no API record, return approved
  try {
    const onChain = await isVerifiedOnChain(wallet);
    if (onChain && !record) {
      return res.json({ status: "approved", walletAddress: wallet, onChain: true });
    }
    if (onChain && record && record.status !== "approved") {
      record.status = "approved";
      record.reviewedAt = new Date().toISOString();
    }
  } catch {
    // chain unavailable — fall back to API record
  }

  if (!record) return res.json({ status: "none" });
  res.json(record);
});

app.post("/api/kyc", async (req, res) => {
  const { walletAddress, fullName, email, country, countryCode } = req.body;
  if (!walletAddress || !fullName || !email || !country) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const existing = kycRequests.find(
    (k) => k.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  );
  if (existing?.status === "approved") {
    return res.json(existing);
  }

  const record: KycRequest = existing ?? {
    id: uuidv4(),
    walletAddress,
    fullName,
    email,
    country,
    countryCode: countryCode || 356,
    status: "pending",
    submittedAt: new Date().toISOString(),
  };

  if (!existing) kycRequests.push(record);

  startKycRegistration(record);
  res.status(202).json({ ...record, processing: true });
});

// Dev shortcut: instantly verify any connected wallet
app.post("/api/kyc/verify", async (req, res) => {
  const { walletAddress, countryCode = 356 } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ error: "walletAddress required" });
  }

  let record = kycRequests.find(
    (k) => k.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  );

  if (!record) {
    record = {
      id: uuidv4(),
      walletAddress,
      fullName: "Test User",
      email: "test@terrablock.dev",
      country: "India",
      countryCode,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };
    kycRequests.push(record);
  }

  startKycRegistration(record);
  res.status(202).json({ ...record, processing: true });
});

app.get("/api/kyc", (_req, res) => {
  res.json(kycRequests);
});

// ─── Investments ──────────────────────────────────────────────────

app.get("/api/investments/:wallet", (req, res) => {
  const wallet = req.params.wallet.toLowerCase();
  const userInvestments = investments.filter(
    (i) => i.walletAddress.toLowerCase() === wallet
  );
  res.json(userInvestments);
});

// Record off-chain investment history (on-chain purchase happens via PropertySale contract)
app.post("/api/investments", (req, res) => {
  const { propertyId, walletAddress, tokenAmount, usdValue, txHash } = req.body;

  if (!propertyId || !walletAddress || !tokenAmount || !txHash) {
    return res.status(400).json({ error: "propertyId, walletAddress, tokenAmount, and txHash required" });
  }

  const property = properties.find((p) => p.id === propertyId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const investment: Investment = {
    id: uuidv4(),
    propertyId,
    walletAddress,
    tokenAmount,
    usdValue: usdValue ?? tokenAmount * property.tokenPrice,
    txHash,
    createdAt: new Date().toISOString(),
  };
  investments.push(investment);
  res.status(201).json(investment);
});

// ─── Identity registration helper ───────────────────────────────

app.post("/api/identity/register", (req, res) => {
  const { walletAddress, countryCode } = req.body;
  res.json({
    message: "Identity registration queued on-chain",
    walletAddress,
    countryCode: countryCode || 356,
    instructions:
      "Call identityRegistry.registerIdentity() via admin or use the issuer dashboard",
  });
});

app.listen(PORT, () => {
  console.log(`RWA API running on http://localhost:${PORT}`);
});
