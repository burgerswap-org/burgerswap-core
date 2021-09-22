let fs = require("fs");
let path = require("path");
const ethers = require("ethers")
const erc20 = require("../build/ERC20.json")
const platform = require("../build/DemaxPlatform.json")
const demaxConfig = require("../build/DemaxConfig.json")
const dgas = require("../build/DgasTest.json")
const usdt = require("../build/usdt.json")
const demaxPair = require("../build/DemaxPair.json")
const weth = require("../build/WETH9.json")
const demaxPool = require("../build/DemaxPool.json")
const demaxFactory = require("../build/DemaxFactory.json")
const demaxGovernance = require("../build/DemaxGovernance.json")
const ballotFactory = require("../build/DemaxBallotFactory.json")
const transferListener = require("../build/DemaxTransferListener.json")
const demaxQuery = require("../build/DemaxQuery.json")
const demaxQuery2 = require("../build/DemaxQuery2.json")
const demaxDelegate = require("../build/demaxDelegate.json")
const {bigNumberify} = require("ethers/utils")
const Web3 = require("web3")
const web3 = new Web3()
const USER_HOME = process.env.HOME || process.env.USERPROFILE

let config = {
  "gasPrice": "10",
  "url": "",
  "pk": "",
  "devWallet": "",
  "adminWallet": "",
  "WETH": "",
  "DGAS": "",
  "DemaxPlatform": "",
  "DemaxConfig": "",
  "DemaxFactory": "",
  "DemaxDelegate": "",
  "DemaxPool": "",
  "DemaxGovernance": "",
  "DemaxQuery": "",
  "DemaxQuery2": "",
  "DemaxTransferListener": "",
  "DemaxBallotFactory": ""
}

if(fs.existsSync(path.join(USER_HOME+'/.config.upgrade.plateform.json'))) {
  config = JSON.parse(fs.readFileSync(path.join(USER_HOME+'/.config.upgrade.plateform.json')).toString());
}
if(fs.existsSync(path.join(__dirname, ".config.upgrade.plateform.json"))) {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, ".config.upgrade.plateform.json")).toString());
}



let ETHER_SEND_CONFIG = {
  gasPrice: ethers.utils.parseUnits(config.gasPrice, "gwei")
}

console.log("config url", config.url)

let provider = new ethers.providers.JsonRpcProvider(config.url)

const privateKey = config.pk
const ownerAddress = web3.eth.accounts.privateKeyToAccount(privateKey).address
console.log('wallet ', ownerAddress)

function expandTo18Decimals(n, p = 18) {
  return bigNumberify(n).mul(bigNumberify(10).pow(p))
}

function getWallet(key = privateKey) {
  return new ethers.Wallet(key, provider)
}

const sleep = ms =>
  new Promise(resolve =>
    setTimeout(() => {
      resolve()
    }, ms)
  )

async function waitForMint(tx) {
  let result = null
  do {
    result = await provider.getTransactionReceipt(tx)
    await sleep(100)
  } while (result === null)
  await sleep(200)
  console.log('tx: ', tx)
}

async function getBlockNumber() {
  return await provider.getBlockNumber()
}

async function upgrade() {
  console.log("start upgrade...")

  console.log('DemaxPlatform initialize...')
  let ins = new ethers.Contract(
    config.DemaxPlatform,
    platform.abi,
    getWallet()
  )
  let tx = await ins.pause(
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)
  tx = await ins.initialize(
    config.DGAS,
    config.DemaxConfig,
    config.DemaxFactory,
    config.WETH,
    config.DemaxGovernance,
    config.DemaxTransferListener,
    config.DemaxPool,
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)

  console.log('DemaxTransferListener initialize...')
  ins = new ethers.Contract(
    config.DemaxTransferListener,
    transferListener.abi,
    getWallet()
  )
  tx = await ins.initialize(
    config.DGAS,
    config.DemaxFactory,
    config.WETH,
    config.DemaxPlatform,
    config.adminWallet,
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)

  // console.log('DemaxGovernance initialize...')
  // ins = new ethers.Contract(
  //   config.DemaxGovernance,
  //   demaxGovernance.abi,
  //   getWallet()
  // )
  // tx = await ins.initialize(
  //   config.DemaxPool,
  //   config.DemaxConfig,
  //   config.DemaxBallotFactory,
  //   ETHER_SEND_CONFIG
  // )
  // await waitForMint(tx.hash)

  console.log('DemaxPool initialize...')
  ins = new ethers.Contract(config.DemaxPool, demaxPool.abi, getWallet())
  tx = await ins.initialize(
    config.DGAS,
    config.WETH,
    config.DemaxFactory,
    config.DemaxPlatform,
    config.DemaxConfig,
    config.DemaxGovernance,
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)

  console.log('DemaxConfig initialize...')
  ins = new ethers.Contract(config.DemaxConfig, demaxConfig.abi, getWallet())
  tx = await ins.initialize(
    config.DGAS,
    config.DemaxGovernance,
    config.DemaxPlatform,
    config.devWallet,
    [],
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)

  // DEMAX QUERY
  console.log("DemaxQuery upgrade...")
  ins = new ethers.Contract(config.DemaxQuery, demaxQuery.abi, getWallet())
  tx = await ins.upgrade(config.DemaxConfig, config.DemaxPlatform, config.DemaxFactory, config.DemaxGovernance, config.DemaxTransferListener, ETHER_SEND_CONFIG)
  await waitForMint(tx.hash)

  // DEMAX QUERY2
  console.log("DemaxQuery2 upgrade...")
  ins = new ethers.Contract(config.DemaxQuery2, demaxQuery2.abi, getWallet())
  tx = await ins.upgrade(config.DemaxConfig, config.DemaxPlatform, config.DemaxFactory, config.DemaxGovernance, config.DemaxTransferListener, config.DemaxDelegate, ETHER_SEND_CONFIG)
  await waitForMint(tx.hash)

  console.log("DemaxDelegate DemaxDelegate...")
  ins = new ethers.Contract(config.DemaxDelegate, demaxDelegate.abi, getWallet())
  tx = await ins.initialize(
    config.DemaxPlatform,
    config.DemaxPool,
    config.DGAS,
    config.WETH,
    {
    ...ETHER_SEND_CONFIG
  })
  await waitForMint(tx.hash)

  console.log("DemaxDelegate upgradePlatform...")
  ins = new ethers.Contract(config.DemaxDelegate, demaxDelegate.abi, getWallet())
  tx = await ins.upgradePlatform(config.DemaxPlatform, {
    ...ETHER_SEND_CONFIG
  })
  await waitForMint(tx.hash)

  await upgradeOldDelegatePlatform()

  console.log("DemaxPlatform resume...")
  ins = new ethers.Contract(
    config.DemaxPlatform,
    platform.abi,
    getWallet()
  )
  tx = await ins.resume(
    ETHER_SEND_CONFIG
  )
}

async function upgradeOldDelegatePlatform() {
  console.log("DemaxDelegate upgradeOldDelegatePlatform...", config.OldDemaxDelegate)
  let ins = new ethers.Contract(config.OldDemaxDelegate, demaxDelegate.abi, getWallet())
  let tx = await ins.upgradePlatform(config.DemaxPlatform, {
    ...ETHER_SEND_CONFIG
  })
  await waitForMint(tx.hash)
}

upgrade();

