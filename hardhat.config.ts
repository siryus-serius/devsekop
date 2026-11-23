import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
    // Testnet untuk demo: Base Sepolia (L2, gas murah). Faucet: https://docs.base.org/tools/network-faucets
    ...(process.env.BASE_SEPOLIA_RPC_URL
      ? {
          baseSepolia: {
            url: process.env.BASE_SEPOLIA_RPC_URL,
            chainId: 84532,
            accounts: deployerKey ? [deployerKey] : [],
          },
        }
      : {}),
  },
};

export default config;
