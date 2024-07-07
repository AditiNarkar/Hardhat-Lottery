// require("@nomiclabs/hardhat-waffle")
require("@nomicfoundation/hardhat-toolbox")
// require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;


module.exports = {
  solidity: "0.8.24",

  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      chainId: 31337,
      blockConfirmations: 1,
    },
    hardhat: {
      chainId: 31337,
      blockConfirmations: 1,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 11155111, // from chainlink.org
      blockConfirmations: 4,
    },
  },
  mocha: {
    timeout: 1000000 // 200 secs max for testing event calls
  },
  namedAccounts: {
    deployer: { default: 0 },
    player: { default: 1 }
  },
  gasReporter: {
    enabled: false,
    outputFile: "gas-report.txt",
    currency: "INR",
    noColors: true,
    // coinmarketcap: COINMARKETCAP_API_KEY,
    token: "MATIC",
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
};
