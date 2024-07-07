// yarn hardhat node -> to run

const { ethers, network } = require("hardhat")
const fs = require("fs")

const FRONTEND_PATH_ADD = "../full-stack-lottery/constants/contractAddresses.json"
const FRONTEND_PATH_ABI = "../full-stack-lottery/constants/abi.json"

module.exports = async () => {
    if (process.env.UPDATE_FRONTEND) {
        console.log("Updating Frontend...")
        updateContractAddresses()
        updateAbi()
    }
}

async function updateAbi() {
    const { deploy, log } = deployments
    const lotteryContract = await ethers.getContractAt(
        "Lottery",
        (await deployments.get("Lottery")).address
    );
    fs.writeFileSync(FRONTEND_PATH_ABI, lotteryContract.interface.formatJson());
}


async function updateContractAddresses() {
    const { deploy, log } = deployments
    // const lotteryContractAddress = (await deployments.get("Lottery")).address
    const lotteryContract = await ethers.getContractAt(
        "Lottery",
        (await deployments.get("Lottery")).address
    );

    const chain_Id = network.config.chainId.toString();
    const currentAddresses = JSON.parse(fs.readFileSync(FRONTEND_PATH_ADD, "utf-8"))

    if (chain_Id in currentAddresses) {
        if (!currentAddresses[chain_Id].includes(lotteryContract.target)) {
            currentAddresses[chain_Id].push(lotteryContract.target)
        }
    }
    else {
        currentAddresses[chain_Id] = [lotteryContract.target]
    }

    // "11155111": [asdfg, hjkl, rtyu]
    fs.writeFileSync(FRONTEND_PATH_ADD, JSON.stringify(currentAddresses))
}

module.exports.tags = ["all", "frontend"]