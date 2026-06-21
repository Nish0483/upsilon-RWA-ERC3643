import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import OnchainID from "@onchain-id/solidity";
import TREX from "@erc3643org/erc-3643";

// Deploys a single MultiPropertySale that sells ALL property tokens, reusing the
// shared IdentityRegistry. It only needs to be registered as a verified identity
// once, then each token is listed + funded with fresh inventory.

const KYC_CLAIM_TOPIC = 1n;
const COUNTRY_CODE = 356;

async function main() {
  const apiPath = path.resolve(__dirname, "../../../apps/api/src/deployments.json");
  const webPath = path.resolve(__dirname, "../../../apps/web/src/lib/deployments.json");
  const existing = JSON.parse(fs.readFileSync(apiPath, "utf8"));

  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  console.log("Deployer:", deployerAddr);

  const fd = await ethers.provider.getFeeData();
  const gasPrice = ((fd.gasPrice ?? ethers.parseUnits("2", "gwei")) * 3n) / 2n;
  const ovr = { gasPrice };
  const wait = async <T extends { wait: (c?: number) => Promise<unknown> }>(tx: T) => {
    await tx.wait(1);
    return tx;
  };

  const identityRegistryAddr = existing.identityRegistry as string;
  const claimIssuerAddr = existing.claimIssuer as string;
  const treasury = existing.treasury as string;

  // Tokens to list: [tokenAddress, priceWei, inventory(full tokens)].
  const listings = [
    { token: existing.token as string, priceWei: BigInt(existing.tokenPriceWei), inventory: 750_000 },
    {
      token: existing.secondaryToken as string,
      priceWei: BigInt(existing.secondaryTokenPriceWei),
      inventory: 420_000,
    },
  ];

  // 1. Deploy MultiPropertySale.
  console.log("Deploying MultiPropertySale...");
  const MultiPropertySale = await ethers.getContractFactory("MultiPropertySale");
  const sale = await MultiPropertySale.deploy(identityRegistryAddr, treasury, ovr);
  await sale.waitForDeployment();
  const saleAddr = await sale.getAddress();
  console.log("MultiPropertySale:", saleAddr);

  // 2. Register the sale contract as a verified identity (once).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idFactory = (await ethers.getContractAt(
    OnchainID.contracts.Factory.abi,
    existing.identityFactory,
    deployer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ir = (await ethers.getContractAt(
    TREX.contracts.IdentityRegistry.abi,
    identityRegistryAddr,
    deployer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any;

  if (!(await ir.isVerified(saleAddr))) {
    console.log("Registering MultiPropertySale as verified identity...");
    const claimSigner = new ethers.Wallet(process.env.CLAIM_ISSUER_SIGNING_KEY as string);
    const managementKey = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["address"], [deployerAddr])
    );

    let identityAddr: string = await idFactory.getIdentity(saleAddr);
    if (identityAddr === ethers.ZeroAddress) {
      identityAddr = await idFactory.createIdentityWithManagementKeys.staticCall(saleAddr, `multisale`, [
        managementKey,
      ]);
      await wait(await idFactory.createIdentityWithManagementKeys(saleAddr, `multisale`, [managementKey], ovr));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const identity = (await ethers.getContractAt(
      OnchainID.contracts.Identity.abi,
      identityAddr,
      deployer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as any;
    if ((await identity.getClaimIdsByTopic(KYC_CLAIM_TOPIC)).length === 0) {
      const claimData = ethers.hexlify(ethers.toUtf8Bytes("KYC approved (demo)"));
      const dataHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "uint256", "bytes"],
          [identityAddr, KYC_CLAIM_TOPIC, claimData]
        )
      );
      const signature = await claimSigner.signMessage(ethers.getBytes(dataHash));
      await wait(await identity.addClaim(KYC_CLAIM_TOPIC, 1, claimIssuerAddr, signature, claimData, "", ovr));
    }
    await wait(await ir.registerIdentity(saleAddr, identityAddr, COUNTRY_CODE, ovr));
  }

  // 3. List + fund each token with fresh inventory (deployer is a token agent).
  for (const { token: tokenAddr, priceWei, inventory } of listings) {
    const token = await ethers.getContractAt(TREX.contracts.Token.abi, tokenAddr, deployer);
    const amount = ethers.parseEther(String(inventory));
    console.log(`Listing ${tokenAddr} @ ${priceWei} wei, funding ${inventory} tokens...`);
    await wait(await sale.listToken(tokenAddr, priceWei, ovr));
    await wait(await token.mint(deployerAddr, amount, ovr));
    await wait(await token.approve(saleAddr, amount, ovr));
    await wait(await sale.depositTokens(tokenAddr, amount, ovr));
  }

  // 4. Persist the shared sale address.
  const merged = { ...existing, multiSale: saleAddr };
  const json = JSON.stringify(merged, null, 2);
  fs.writeFileSync(apiPath, json);
  fs.writeFileSync(webPath, json);

  console.log("\nMultiPropertySale deployed and funded:", saleAddr);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
