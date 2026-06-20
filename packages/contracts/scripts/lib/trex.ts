import { ethers } from "hardhat";
import TREX from "@erc3643org/erc-3643";
import OnchainID from "@onchain-id/solidity";

export const KYC_CLAIM_TOPIC = 1n;

export type TrexSuite = {
  claimTopicsRegistry: string;
  trustedIssuersRegistry: string;
  identityRegistryStorage: string;
  identityRegistry: string;
  compliance: string;
  token: string;
  tokenOID: string;
  claimIssuer: string;
  claimIssuerSigningKey: ethers.HDNodeWallet;
  identityImplementationAuthority: string;
  identityFactory: string;
  trexFactory: string;
  trexImplementationAuthority: string;
};

function factory(name: string, artifact: { abi: unknown; bytecode: string }, signer: ethers.Signer) {
  return new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
}

async function confirmTx<T extends { wait: (c?: number) => Promise<unknown> }>(tx: T): Promise<T> {
  await tx.wait(2);
  return tx;
}

async function deployStep<T>(label: string, deploy: () => Promise<T>): Promise<T> {
  const start = Date.now();
  console.log(`  → ${label}...`);
  const result = await deploy();

  if (
    result &&
    typeof result === "object" &&
    "wait" in result &&
    typeof (result as { wait: (c?: number) => Promise<unknown> }).wait === "function"
  ) {
    await (result as { wait: (c?: number) => Promise<unknown> }).wait(2);
  }

  const secs = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`    ✓ ${label} (${secs}s)`);
  return result;
}

export async function deployIdentityProxy(
  implementationAuthority: string,
  managementKey: string,
  signer: ethers.Signer
) {
  const proxy = await factory("IdentityProxy", OnchainID.contracts.IdentityProxy, signer).deploy(
    implementationAuthority,
    managementKey
  );
  await proxy.waitForDeployment();
  return ethers.getContractAt(
    OnchainID.contracts.Identity.abi,
    await proxy.getAddress(),
    signer
  );
}

export async function deployTrexSuite(
  deployer: ethers.Signer,
  tokenAgent: ethers.Signer,
  tokenName = "Koramangala Skyrise",
  tokenSymbol = "KORA"
): Promise<TrexSuite> {
  const claimIssuerWallet = ethers.Wallet.createRandom().connect(ethers.provider);

  console.log("T-REX suite: deploying implementations...");
  const claimTopicsRegistryImplementation = await deployStep("ClaimTopicsRegistry impl", () =>
    factory("ClaimTopicsRegistry", TREX.contracts.ClaimTopicsRegistry, deployer)
      .deploy()
      .then(async (c) => {
        await c.waitForDeployment();
        return c;
      })
  );

  const trustedIssuersRegistryImplementation = await deployStep("TrustedIssuersRegistry impl", () =>
    factory("TrustedIssuersRegistry", TREX.contracts.TrustedIssuersRegistry, deployer)
      .deploy()
      .then(async (c) => {
        await c.waitForDeployment();
        return c;
      })
  );

  const identityRegistryStorageImplementation = await deployStep("IdentityRegistryStorage impl", () =>
    factory("IdentityRegistryStorage", TREX.contracts.IdentityRegistryStorage, deployer)
      .deploy()
      .then(async (c) => {
        await c.waitForDeployment();
        return c;
      })
  );

  const identityRegistryImplementation = await deployStep("IdentityRegistry impl", () =>
    factory("IdentityRegistry", TREX.contracts.IdentityRegistry, deployer)
      .deploy()
      .then(async (c) => {
        await c.waitForDeployment();
        return c;
      })
  );

  const modularComplianceImplementation = await deployStep("ModularCompliance impl", () =>
    factory("ModularCompliance", TREX.contracts.ModularCompliance, deployer)
      .deploy()
      .then(async (c) => {
        await c.waitForDeployment();
        return c;
      })
  );

  const tokenImplementation = await deployStep("Token impl", () =>
    factory("Token", TREX.contracts.Token, deployer)
      .deploy()
      .then(async (c) => {
        await c.waitForDeployment();
        return c;
      })
  );

  const identityImplementation = await deployStep("Identity impl", async () => {
    const c = await factory("Identity", OnchainID.contracts.Identity, deployer).deploy(
      await deployer.getAddress(),
      true
    );
    await c.waitForDeployment();
    return c;
  });

  const identityImplementationAuthority = await deployStep("Identity ImplementationAuthority", async () => {
    const c = await factory(
      "ImplementationAuthority",
      OnchainID.contracts.ImplementationAuthority,
      deployer
    ).deploy(await identityImplementation.getAddress());
    await c.waitForDeployment();
    return c;
  });

  const identityFactory = await deployStep("IdFactory", async () => {
    const c = await factory("IdFactory", OnchainID.contracts.Factory, deployer).deploy(
      await identityImplementationAuthority.getAddress()
    );
    await c.waitForDeployment();
    return c;
  });

  const trexImplementationAuthority = await deployStep("TREXImplementationAuthority", () =>
    factory("TREXImplementationAuthority", TREX.contracts.TREXImplementationAuthority, deployer)
      .deploy(true, ethers.ZeroAddress, ethers.ZeroAddress)
      .then(async (c) => {
        await c.waitForDeployment();
        return c;
      })
  );

  const versionStruct = { major: 4, minor: 1, patch: 3 };
  const contractsStruct = {
    tokenImplementation: await tokenImplementation.getAddress(),
    ctrImplementation: await claimTopicsRegistryImplementation.getAddress(),
    irImplementation: await identityRegistryImplementation.getAddress(),
    irsImplementation: await identityRegistryStorageImplementation.getAddress(),
    tirImplementation: await trustedIssuersRegistryImplementation.getAddress(),
    mcImplementation: await modularComplianceImplementation.getAddress(),
  };

  const ia = await ethers.getContractAt(
    TREX.contracts.TREXImplementationAuthority.abi,
    await trexImplementationAuthority.getAddress(),
    deployer
  );
  await deployStep("addAndUseTREXVersion", async () => {
    const tx = await ia.addAndUseTREXVersion(versionStruct, contractsStruct);
    return tx;
  });

  const trexFactory = await deployStep("TREXFactory", async () => {
    const c = await factory("TREXFactory", TREX.contracts.TREXFactory, deployer).deploy(
      await trexImplementationAuthority.getAddress(),
      await identityFactory.getAddress()
    );
    await c.waitForDeployment();
    return c;
  });

  const idFactory = await ethers.getContractAt(
    OnchainID.contracts.Factory.abi,
    await identityFactory.getAddress(),
    deployer
  );
  await deployStep("link token factory", async () => {
    const tx = await idFactory.addTokenFactory(await trexFactory.getAddress());
    return tx;
  });

  console.log("T-REX suite: deploying proxies...");

  const claimTopicsRegistry = await deployStep("ClaimTopicsRegistry proxy", async () =>
    factory("ClaimTopicsRegistryProxy", TREX.contracts.ClaimTopicsRegistryProxy, deployer)
      .deploy(await trexImplementationAuthority.getAddress())
      .then(async (proxy) => {
        await proxy.waitForDeployment();
        return ethers.getContractAt(
          TREX.contracts.ClaimTopicsRegistry.abi,
          await proxy.getAddress(),
          deployer
        );
      })
  );

  const trustedIssuersRegistry = await deployStep("TrustedIssuersRegistry proxy", async () =>
    factory("TrustedIssuersRegistryProxy", TREX.contracts.TrustedIssuersRegistryProxy, deployer)
      .deploy(await trexImplementationAuthority.getAddress())
      .then(async (proxy) => {
        await proxy.waitForDeployment();
        return ethers.getContractAt(
          TREX.contracts.TrustedIssuersRegistry.abi,
          await proxy.getAddress(),
          deployer
        );
      })
  );

  const identityRegistryStorage = await deployStep("IdentityRegistryStorage proxy", async () =>
    factory("IdentityRegistryStorageProxy", TREX.contracts.IdentityRegistryStorageProxy, deployer)
      .deploy(await trexImplementationAuthority.getAddress())
      .then(async (proxy) => {
        await proxy.waitForDeployment();
        return ethers.getContractAt(
          TREX.contracts.IdentityRegistryStorage.abi,
          await proxy.getAddress(),
          deployer
        );
      })
  );

  const identityRegistry = await deployStep("IdentityRegistry proxy", async () =>
    factory("IdentityRegistryProxy", TREX.contracts.IdentityRegistryProxy, deployer)
      .deploy(
        await trexImplementationAuthority.getAddress(),
        await trustedIssuersRegistry.getAddress(),
        await claimTopicsRegistry.getAddress(),
        await identityRegistryStorage.getAddress()
      )
      .then(async (proxy) => {
        await proxy.waitForDeployment();
        return ethers.getContractAt(
          TREX.contracts.IdentityRegistry.abi,
          await proxy.getAddress(),
          deployer
        );
      })
  );

  const compliance = await deployStep("ModularCompliance proxy", async () =>
    factory("ModularComplianceProxy", TREX.contracts.ModularComplianceProxy, deployer)
      .deploy(await trexImplementationAuthority.getAddress())
      .then(async (proxy) => {
        await proxy.waitForDeployment();
        return ethers.getContractAt(
          TREX.contracts.ModularCompliance.abi,
          await proxy.getAddress(),
          deployer
        );
      })
  );

  const tokenOID = await deployStep("token ONCHAINID", async () =>
    deployIdentityProxy(
      await identityImplementationAuthority.getAddress(),
      await deployer.getAddress(),
      deployer
    )
  );

  const token = await deployStep("Token proxy", async () =>
    factory("TokenProxy", TREX.contracts.TokenProxy, deployer)
      .deploy(
        await trexImplementationAuthority.getAddress(),
        await identityRegistry.getAddress(),
        await compliance.getAddress(),
        tokenName,
        tokenSymbol,
        18,
        await tokenOID.getAddress()
      )
      .then(async (proxy) => {
        await proxy.waitForDeployment();
        return ethers.getContractAt(TREX.contracts.Token.abi, await proxy.getAddress(), deployer);
      })
  );

  console.log("T-REX suite: wiring contracts...");
  await deployStep("bind identity registry", async () => {
    const tx = await identityRegistryStorage.bindIdentityRegistry(await identityRegistry.getAddress());
    return tx;
  });
  await deployStep("bind token to compliance", async () => {
    const tx = await compliance.bindToken(await token.getAddress());
    return tx;
  });
  await deployStep("add token agent", async () => {
    const tx = await token.addAgent(await tokenAgent.getAddress());
    return tx;
  });
  await deployStep("add identity registry agent (operator)", async () => {
    const tx = await identityRegistry.addAgent(await tokenAgent.getAddress());
    return tx;
  });
  await deployStep("add identity registry agent (token)", async () => {
    const tx = await identityRegistry.addAgent(await token.getAddress());
    return tx;
  });
  await deployStep("add KYC claim topic", async () => {
    const tx = await claimTopicsRegistry.addClaimTopic(KYC_CLAIM_TOPIC);
    return tx;
  });

  const claimIssuer = await deployStep("ClaimIssuer", async () => {
    const c = await factory("ClaimIssuer", OnchainID.contracts.ClaimIssuer, deployer).deploy(
      await deployer.getAddress()
    );
    await c.waitForDeployment();
    return c;
  });

  const claimIssuerContract = await ethers.getContractAt(
    OnchainID.contracts.ClaimIssuer.abi,
    await claimIssuer.getAddress(),
    deployer
  );

  const signingKeyHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address"], [claimIssuerWallet.address])
  );
  await deployStep("add claim issuer signing key", async () => {
    const tx = await claimIssuerContract.addKey(signingKeyHash, 3, 1);
    return tx;
  });
  await deployStep("register trusted issuer", async () => {
    const tx = await trustedIssuersRegistry.addTrustedIssuer(await claimIssuer.getAddress(), [
      KYC_CLAIM_TOPIC,
    ]);
    return tx;
  });
  await deployStep("unpause token", async () => {
    const tx = await token.unpause();
    return tx;
  });

  return {
    claimTopicsRegistry: await claimTopicsRegistry.getAddress(),
    trustedIssuersRegistry: await trustedIssuersRegistry.getAddress(),
    identityRegistryStorage: await identityRegistryStorage.getAddress(),
    identityRegistry: await identityRegistry.getAddress(),
    compliance: await compliance.getAddress(),
    token: await token.getAddress(),
    tokenOID: await tokenOID.getAddress(),
    claimIssuer: await claimIssuer.getAddress(),
    claimIssuerSigningKey: claimIssuerWallet,
    identityImplementationAuthority: await identityImplementationAuthority.getAddress(),
    identityFactory: await identityFactory.getAddress(),
    trexFactory: await trexFactory.getAddress(),
    trexImplementationAuthority: await trexImplementationAuthority.getAddress(),
  };
}

export async function registerInvestorWithClaim(
  suite: TrexSuite,
  agent: ethers.Signer,
  walletAddress: string,
  countryCode: number,
  salt: string
) {
  const deployer = agent;
  const idFactory = await ethers.getContractAt(
    OnchainID.contracts.Factory.abi,
    suite.identityFactory,
    deployer
  );
  const identityRegistry = await ethers.getContractAt(
    TREX.contracts.IdentityRegistry.abi,
    suite.identityRegistry,
    agent
  );

  const deployerAddress = await deployer.getAddress();
  const walletIsAgent = walletAddress.toLowerCase() === deployerAddress.toLowerCase();

  let identityAddress: string;
  if (walletIsAgent) {
    identityAddress = await idFactory.createIdentity.staticCall(walletAddress, salt);
    await confirmTx(await idFactory.createIdentity(walletAddress, salt));
  } else {
    const managementKey = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["address"], [deployerAddress])
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

  const identity = await ethers.getContractAt(
    OnchainID.contracts.Identity.abi,
    identityAddress,
    deployer
  );

  const claimData = ethers.hexlify(ethers.toUtf8Bytes("KYC approved (demo)"));
  const dataHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes"],
      [identityAddress, KYC_CLAIM_TOPIC, claimData]
    )
  );
  const signature = await suite.claimIssuerSigningKey.signMessage(ethers.getBytes(dataHash));

  await confirmTx(
    await identity.addClaim(KYC_CLAIM_TOPIC, 1, suite.claimIssuer, signature, claimData, "")
  );

  await confirmTx(
    await identityRegistry.registerIdentity(walletAddress, identityAddress, countryCode)
  );

  return { identityAddress, signature };
}
