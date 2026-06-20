import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { deployTrexSuite, registerInvestorWithClaim } from "./lib/trex";

const INDIA_COUNTRY_CODE = 356;
const TOKEN_NAME = "Koramangala Skyrise";
const TOKEN_SYMBOL = "KORA";

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const isLocal = chainId === 31337;

  if (!isLocal && !process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required — set it in apps/api/.env.local");
  }
  if (!isLocal && !process.env.RPC_URL) {
    throw new Error("RPC_URL is required — set it in apps/api/.env.local");
  }

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const treasury = isLocal && signers.length > 3 ? signers[3] : deployer;

  console.log(`Deploying official T-REX suite on chain ${chainId} with:`, await deployer.getAddress());
  console.log("(Sepolia deploys ~30 txs — expect 15–30 minutes)\n");

  const suite = await deployTrexSuite(deployer, deployer, TOKEN_NAME, TOKEN_SYMBOL);
  console.log("\nDeploying PropertySale...");
  const token = await ethers.getContractAt(
    (await import("@erc3643org/erc-3643")).contracts.Token.abi,
    suite.token,
    deployer
  );

  const TOKEN_PRICE_WEI = ethers.parseEther("0.01");
  const saleInventory = ethers.parseEther("750000");

  const PropertySale = await ethers.getContractFactory("PropertySale");
  const sale = await PropertySale.deploy(
    suite.token,
    suite.identityRegistry,
    await treasury.getAddress(),
    TOKEN_PRICE_WEI
  );
  await sale.waitForDeployment();
  const saleAddress = await sale.getAddress();

  console.log("Registering property sale contract...");
  await registerInvestorWithClaim(
    suite,
    deployer,
    saleAddress,
    INDIA_COUNTRY_CODE,
    "property-sale"
  );

  console.log("Registering deployer...");
  await registerInvestorWithClaim(
    suite,
    deployer,
    await deployer.getAddress(),
    INDIA_COUNTRY_CODE,
    "deployer"
  );

  const investors: string[] = [];
  if (isLocal) {
    const [, investor1, investor2] = signers;
    await registerInvestorWithClaim(suite, deployer, investor1.address, INDIA_COUNTRY_CODE, "investor-1");
    await registerInvestorWithClaim(suite, deployer, investor2.address, INDIA_COUNTRY_CODE, "investor-2");
    investors.push(investor1.address, investor2.address);
  }

  console.log("Minting and funding PropertySale...");
  await (await token.mint(await deployer.getAddress(), ethers.parseEther("1000000"))).wait(2);
  await (await token.approve(saleAddress, saleInventory)).wait(2);
  await (await sale.depositTokens(saleInventory)).wait(2);

  console.log("IdentityRegistry:", suite.identityRegistry);
  console.log("Compliance:", suite.compliance);
  console.log(`Token (${TOKEN_SYMBOL}):`, suite.token);
  console.log("PropertySale:", saleAddress);
  console.log("Treasury:", await treasury.getAddress());
  console.log("ClaimIssuer:", suite.claimIssuer);
  console.log("IdentityFactory:", suite.identityFactory);

  const deployments = {
    chainId,
    trexVersion: "4.1.3",
    identityRegistry: suite.identityRegistry,
    compliance: suite.compliance,
    token: suite.token,
    propertySale: saleAddress,
    treasury: await treasury.getAddress(),
    claimIssuer: suite.claimIssuer,
    identityFactory: suite.identityFactory,
    claimTopic: "1",
    tokenSymbol: TOKEN_SYMBOL,
    tokenName: TOKEN_NAME,
    tokenPriceWei: TOKEN_PRICE_WEI.toString(),
    deployer: await deployer.getAddress(),
    investors,
  };

  const rpcUrl = process.env.RPC_URL || (isLocal ? "http://127.0.0.1:8545" : "");
  const apiEnv = [
    `CLAIM_ISSUER_SIGNING_KEY=${suite.claimIssuerSigningKey.privateKey}`,
    `RPC_URL=${rpcUrl}`,
    "# DEPLOYER_PRIVATE_KEY must be set separately in apps/api/.env.local",
    "",
  ].join("\n");

  const outDir = path.join(__dirname, "../../../apps");
  const apiPath = path.resolve(outDir, "api/src/deployments.json");
  const webPath = path.resolve(outDir, "web/src/lib/deployments.json");
  const apiEnvPath = path.resolve(outDir, "api/.env.local");

  fs.mkdirSync(path.dirname(apiPath), { recursive: true });
  fs.mkdirSync(path.dirname(webPath), { recursive: true });

  const json = JSON.stringify(deployments, null, 2);
  fs.writeFileSync(apiPath, json);
  fs.writeFileSync(webPath, json);

  const existingEnv = fs.existsSync(apiEnvPath) ? fs.readFileSync(apiEnvPath, "utf8") : "";
  const deployerLine = existingEnv
    .split("\n")
    .find((line) => line.startsWith("DEPLOYER_PRIVATE_KEY="));
  fs.writeFileSync(
    apiEnvPath,
    deployerLine ? `${deployerLine}\n${apiEnv}` : apiEnv
  );

  console.log("\nDeployment addresses written to:");
  console.log("  API:", apiPath);
  console.log("  Web:", webPath);
  console.log("  API env:", apiEnvPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
