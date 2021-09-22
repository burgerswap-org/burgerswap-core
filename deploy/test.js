let fs = require("fs");
let path = require("path");
const ethers = require("ethers")

const DemaxProjectFactory = require("../build/DemaxProjectFactory.json");
const DemaxProjectPool = require("../build/DemaxProjectPool.json");

async function run() {
  let res = ethers.utils.keccak256('0x'+ DemaxProjectFactory.bytecode)
  console.log('DemaxProjectFactory:',res)

  res = ethers.utils.keccak256('0x'+ DemaxProjectPool.bytecode)
  console.log('DemaxProjectPool:',res)
}
run()
