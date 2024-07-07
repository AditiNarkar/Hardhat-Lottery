const { network, ethers } = require("hardhat")
const { networkConfig, devChains } = require("../helper-hardhat-config.js")
const { verify } = require("../utils/verify.js")


const VRF_SUBSCRIPTION_FUND_AMT = ethers.parseEther("1") // 1 ETH or 1e18 ( 10^18) wei


module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    let vrfCoordinatorV2Address, subscription_Id

    if (devChains.includes(network.name)) {
        const coordinatorV2 = await deployments.get("VRFCoordinatorV2Mock");
        const vrfCoordinatorV2Mock = await ethers.getContractAt(
            coordinatorV2.abi, 
            coordinatorV2.address
        );
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.target

        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait()

        subscription_Id = transactionReceipt.logs[0].args.subId //createSubscription() creates an event and subId
        // subscription_Id = 1

        //Fund Subscription, needs LINK token on real network
        await vrfCoordinatorV2Mock.fundSubscription(subscription_Id, VRF_SUBSCRIPTION_FUND_AMT)
    }
    else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscription_Id = networkConfig[chainId]["subscription_Id"]
    }

    const entranceFee = networkConfig[chainId]["entranceFee"]
    const keyHash = networkConfig[chainId]["keyHash"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]

    const args = [
        vrfCoordinatorV2Address,
        entranceFee,
        keyHash,
        subscription_Id,
        callbackGasLimit,
        interval,
    ]
    const LotteryContract = await deploy("Lottery", {
        from: deployer,
        args: args, // contract constructor parameters
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    // verify
    if (!devChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(LotteryContract.address, args)
    }
}

module.exports.tags = ["all", "lottery"]