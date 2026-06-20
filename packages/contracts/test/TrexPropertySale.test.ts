import { expect } from "chai";
import { ethers } from "hardhat";
import { deployTrexSuite, registerInvestorWithClaim } from "../scripts/lib/trex";

describe("Official T-REX + PropertySale (ETH)", function () {
  it("deploys suite and buys tokens with ETH", async function () {
    const [deployer, investor, treasury] = await ethers.getSigners();
    const suite = await deployTrexSuite(deployer, deployer);

    const token = await ethers.getContractAt(
      (await import("@erc3643org/erc-3643")).contracts.Token.abi,
      suite.token,
      deployer
    );

    const TOKEN_PRICE = ethers.parseEther("0.01");
    const PropertySale = await ethers.getContractFactory("PropertySale");
    const sale = await PropertySale.deploy(
      suite.token,
      suite.identityRegistry,
      treasury.address,
      TOKEN_PRICE
    );
    await sale.waitForDeployment();

    await registerInvestorWithClaim(suite, deployer, await sale.getAddress(), 840, "sale");
    await registerInvestorWithClaim(suite, deployer, investor.address, 840, "inv");
    await registerInvestorWithClaim(suite, deployer, await deployer.getAddress(), 840, "agent");

    const inventory = ethers.parseEther("10000");
    await token.mint(deployer.address, inventory);
    await token.approve(await sale.getAddress(), inventory);
    await sale.depositTokens(inventory);

    const buyAmount = ethers.parseEther("100");
    const ethCost = (buyAmount * TOKEN_PRICE) / ethers.parseEther("1");
    const treasuryBefore = await ethers.provider.getBalance(treasury.address);

    await sale.connect(investor).buy(buyAmount, { value: ethCost });

    expect(await token.balanceOf(investor.address)).to.equal(buyAmount);
    expect(await ethers.provider.getBalance(treasury.address) - treasuryBefore).to.equal(ethCost);
  });
});
