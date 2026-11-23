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
    ...(process.env.SEPOLIA_RPC_URL
      ? {
          sepolia: {
            url: process.env.SEPOLIA_RPC_URL,
            accounts: deployerKey ? [deployerKey] : [],
          },
        }
      : {}),
  },
};

export default config;
