/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 import { HardhatUserConfig } from "hardhat/types";
 import '@openzeppelin/hardhat-upgrades';
 
 import "@nomiclabs/hardhat-waffle";
 import "@nomiclabs/hardhat-etherscan";
 import "hardhat-typechain";
 import fs from "fs";
 import path from "path";
 const USER_HOME = process.env.HOME || process.env.USERPROFILE
 let data = {
   "PrivateKey": "",
   "InfuraApiKey": "",
   "EtherscanApiKey": "",
 };
 
 let filePath = path.join(USER_HOME+'/.hardhat.data.json');
 if (fs.existsSync(filePath)) {
   let rawdata = fs.readFileSync(filePath);
   data = JSON.parse(rawdata.toString());
 }
 filePath = path.join(__dirname, `.hardhat.data.json`);
 if (fs.existsSync(filePath)) {
   let rawdata = fs.readFileSync(filePath);
   data = JSON.parse(rawdata.toString());
 }
 
 const LOWEST_OPTIMIZER_COMPILER_SETTINGS = {
   version: "0.6.6",
   settings: {
     optimizer: {
       enabled: true,
       runs: 200,
     },
     metadata: {
       bytecodeHash: 'none',
     },
   },
 }
 
 const LOWER_OPTIMIZER_COMPILER_SETTINGS = {
   version: "0.6.6",
   settings: {
     optimizer: {
       enabled: true,
       runs: 10_000,
     },
     metadata: {
       bytecodeHash: 'none',
     },
   },
 }
 
 const DEFAULT_COMPILER_SETTINGS = {
   version: "0.6.6",
   settings: {
     optimizer: {
       enabled: true,
       runs: 1_000_000,
     },
     metadata: {
       bytecodeHash: 'none',
     },
   },
 }
 
 const config: HardhatUserConfig = {
   defaultNetwork: "hardhat",
   solidity: {
     compilers: [DEFAULT_COMPILER_SETTINGS],
     overrides: {
     },
   },
   networks: {
     hardhat: {},
     mainnet: {
       url: `https://mainnet.infura.io/v3/${data.InfuraApiKey}`,
       accounts: [data.PrivateKey]
     },
     ropsten: {
       url: `https://ropsten.infura.io/v3/${data.InfuraApiKey}`,
       accounts: [data.PrivateKey]
     },
     rinkeby: {
       url: `https://rinkeby.infura.io/v3/${data.InfuraApiKey}`,
       accounts: [data.PrivateKey]
     },
     bsctestnet: {
       url: `https://rpc.ankr.com/bsc_testnet_chapel`,
       accounts: [data.PrivateKey]
     },
     bscmainnet: {
       url: `https://rpc.ankr.com/bsc`,
       accounts: [data.PrivateKey]
     },
     hecotestnet: {
       url: `https://http-testnet.hecochain.com`,
       accounts: [data.PrivateKey]
     },
     hecomainnet: {
       url: `https://http-mainnet.hecochain.com`,
       accounts: [data.PrivateKey]
     },
     matictestnet: {
       url: `https://matic-mumbai.chainstacklabs.com`,
       accounts: [data.PrivateKey],
       gas: "auto",
       gasPrice: 1000000000
     },
     maticmainnet: {
       url: `https://polygon-mainnet.infura.io/v3/${data.InfuraApiKey}`,
       accounts: [data.PrivateKey],
       gas: 3000000,
       gasPrice: 5000000000
     },
     arbitrumtestnet: {
       url: `https://rinkeby.arbitrum.io/rpc`,
       accounts: [data.PrivateKey],
       gas: "auto",
       gasPrice: 100000000
     },
     arbitrummainnet: {
       url: `https://arb1.arbitrum.io/rpc`,
       accounts: [data.PrivateKey],
     },
   },
   etherscan: {
     apiKey: data.EtherscanApiKey,
   },
   paths: {
     sources: "./contracts",
     tests: "./test",
     cache: "./cache",
     artifacts: "./artifacts"
   },
   mocha: {
     timeout: 100000
   }
 };
 
 export default config;