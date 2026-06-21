import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import TREX from "@erc3643org/erc-3643";
import OnchainID from "@onchain-id/solidity";

// Deploys a SECOND security token + PropertySale that reuses the existing
// T-REX infrastructure (IdentityRegistry, implementation authorities, claim
// issuer) from deployments.json — so KYC carries over from the first token.

const TOKEN_NAME = "UB City Tower";
const TOKEN_SYMBOL = "UBCT";
const SLUG = "ub-city-tower";
const COUNTRY_CODE = 356;
const KYC_CLAIM_TOPIC = 1n;

const TOKEN_PRICE_WEI = ethers.parseEther("0.01");
const MINT_AMOUNT = ethers.parseEther("980000");
const SALE_INVENTORY = ethers.parseEther("420000");

async function main() {
  const apiPath = path.resolve(__dirname, "../../../apps/api/src/deployments.json");
  const webPath = path.resolve(__dirname, "../../../apps/web/src/lib/deployments.json");
  const existing = JSON.parse(fs.readFileSync(apiPath, "utf8"));

  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  console.log("Deployer:", deployerAddr);

  // Bump gas price so txs land in the next block (public Sepolia nodes report a
  // near-zero suggested tip otherwise).
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

  // Recover implementation authorities on-chain.
  const tokenProxy = await ethers.getContractAt(
    ["function getImplementationAuthority() view returns (address)"],
    existing.token,
    deployer
  );
  const trexIA: string = await tokenProxy.getImplementationAuthority();
  // getContractAt on raw vendor ABIs is typed loosely by typechain; cast to a
  // permissive shape so the dynamic method calls below type-check.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idFactory = (await ethers.getContractAt(
    OnchainID.contracts.Factory.abi,
    existing.identityFactory,
    deployer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any;
  const identityIA: string = await idFactory.implementationAuthority();
  console.log("TREX implementationAuthority:", trexIA);
  console.log("Identity implementationAuthority:", identityIA);

  const make = (artifact: { abi: unknown; bytecode: string }) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new ethers.ContractFactory(artifact.abi as any, artifact.bytecode, deployer);

  // 1. ModularCompliance proxy (each token needs its own compliance).
  console.log("Deploying ModularCompliance proxy...");
  const complianceProxy = await make(TREX.contracts.ModularComplianceProxy).deploy(trexIA, ovr);
  await complianceProxy.waitForDeployment();
  const compliance = await ethers.getContractAt(
    TREX.contracts.ModularCompliance.abi,
    await complianceProxy.getAddress(),
    deployer
  );

  // 2. Token ONCHAINID.
  console.log("Deploying token ONCHAINID...");
  const tokenOIDProxy = await make(OnchainID.contracts.IdentityProxy).deploy(identityIA, deployerAddr, ovr);
  await tokenOIDProxy.waitForDeployment();
  const tokenOID = await tokenOIDProxy.getAddress();

  // 3. Token proxy bound to the EXISTING identity registry.
  console.log("Deploying Token proxy...");
  const newTokenProxy = await make(TREX.contracts.TokenProxy).deploy(
    trexIA,
    identityRegistryAddr,
    await compliance.getAddress(),
    TOKEN_NAME,
    TOKEN_SYMBOL,
    18,
    tokenOID,
    ovr
  );
  await newTokenProxy.waitForDeployment();
  const token = await ethers.getContractAt(TREX.contracts.Token.abi, await newTokenProxy.getAddress(), deployer);
  const tokenAddr = await token.getAddress();
  console.log("Token:", tokenAddr);

  // 4. Wire token <-> compliance/registry.
  console.log("Wiring token...");
  await wait(await compliance.bindToken(tokenAddr, ovr));
  await wait(await token.addAgent(deployerAddr, ovr));
  const ir = await ethers.getContractAt(TREX.contracts.IdentityRegistry.abi, identityRegistryAddr, deployer);
  await wait(await ir.addAgent(tokenAddr, ovr));
  await wait(await token.unpause(ovr));

  // 5. Deploy PropertySale.
  console.log("Deploying PropertySale...");
  const PropertySale = await ethers.getContractFactory("PropertySale");
  const sale = await PropertySale.deploy(tokenAddr, identityRegistryAddr, treasury, TOKEN_PRICE_WEI, ovr);
  await sale.waitForDeployment();
  const saleAddr = await sale.getAddress();
  console.log("PropertySale:", saleAddr);

  // 6. Register the sale contract as a verified identity (T-REX requires the
  //    receiver of a transfer to be verified — needed for depositTokens).
  console.log("Registering PropertySale as verified identity...");
  const claimSigner = new ethers.Wallet(process.env.CLAIM_ISSUER_SIGNING_KEY as string);
  const managementKey = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address"], [deployerAddr])
  );

  if (!(await ir.isVerified(saleAddr))) {
    let identityAddr: string = await ir.identity(saleAddr);
    if (identityAddr === ethers.ZeroAddress) identityAddr = await idFactory.getIdentity(saleAddr);
    if (identityAddr === ethers.ZeroAddress) {
      identityAddr = await idFactory.createIdentityWithManagementKeys.staticCall(saleAddr, `sale-${SLUG}`, [
        managementKey,
      ]);
      await wait(await idFactory.createIdentityWithManagementKeys(saleAddr, `sale-${SLUG}`, [managementKey], ovr));
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

  // 7. Mint inventory and fund the sale.
  console.log("Minting and funding sale...");
  await wait(await token.mint(deployerAddr, MINT_AMOUNT, ovr));
  await wait(await token.approve(saleAddr, SALE_INVENTORY, ovr));
  await wait(await sale.depositTokens(SALE_INVENTORY, ovr));

  // 8. Persist to both deployments.json files.
  const secondary = {
    secondaryTokenSlug: SLUG,
    secondaryTokenName: TOKEN_NAME,
    secondaryTokenSymbol: TOKEN_SYMBOL,
    secondaryToken: tokenAddr,
    secondaryCompliance: await compliance.getAddress(),
    secondaryPropertySale: saleAddr,
    secondaryTokenPriceWei: TOKEN_PRICE_WEI.toString(),
  };
  const merged = { ...existing, ...secondary };
  const json = JSON.stringify(merged, null, 2);
  fs.writeFileSync(apiPath, json);
  fs.writeFileSync(webPath, json);

  console.log("\nSecond token deployed and recorded:");
  console.log(secondary);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
