import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Sets distinct per-token prices on the shared MultiPropertySale and syncs the
// values into deployments.json so the frontend cost math matches on-chain.

const KORA_PRICE_ETH = "0.01";
const UBCT_PRICE_ETH = "0.025";

async function main() {
  const apiPath = path.resolve(__dirname, "../../../apps/api/src/deployments.json");
  const webPath = path.resolve(__dirname, "../../../apps/web/src/lib/deployments.json");
  const existing = JSON.parse(fs.readFileSync(apiPath, "utf8"));

  const [deployer] = await ethers.getSigners();
  const fd = await ethers.provider.getFeeData();
  const gasPrice = ((fd.gasPrice ?? ethers.parseUnits("2", "gwei")) * 3n) / 2n;
  const ovr = { gasPrice };

  const sale = await ethers.getContractAt("MultiPropertySale", existing.multiSale, deployer);

  const koraPrice = ethers.parseEther(KORA_PRICE_ETH);
  const ubctPrice = ethers.parseEther(UBCT_PRICE_ETH);

  console.log(`Setting ${existing.tokenSymbol} -> ${KORA_PRICE_ETH} ETH`);
  await (await sale.setTokenPrice(existing.token, koraPrice, ovr)).wait(1);
  console.log(`Setting ${existing.secondaryTokenSymbol} -> ${UBCT_PRICE_ETH} ETH`);
  await (await sale.setTokenPrice(existing.secondaryToken, ubctPrice, ovr)).wait(1);

  const merged = {
    ...existing,
    tokenPriceWei: koraPrice.toString(),
    secondaryTokenPriceWei: ubctPrice.toString(),
  };
  const json = JSON.stringify(merged, null, 2);
  fs.writeFileSync(apiPath, json);
  fs.writeFileSync(webPath, json);

  console.log("Prices updated on-chain and in deployments.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
