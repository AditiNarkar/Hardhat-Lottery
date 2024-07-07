
// Mock to pick a winner instantly ...

const { ethers, network } = require("hardhat")
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

async function mockKeepers() {

    const { deploy, log } = deployments
    const lotteryContract = await ethers.getContractAt(
        "Lottery",
        (await deployments.get("Lottery")).address
    );


    // Enter Raffle
    // await lotteryContract.enterLottery({ value: ethers.parseEther("0.01") });

    // //Increase Time 
    // let interval = await lotteryContract.getInterval();
    // await time.increase(Number(interval) + 1);

    // // Add consumer address
    // subscriptionId = await lotteryContract.getSubscriptionId();
    // const coordinatorV2 = await deployments.get("VRFCoordinatorV2Mock");
    // const vrfCoordinatorV2Mock = await ethers.getContractAt(
    //     coordinatorV2.abi,
    //     coordinatorV2.address
    // );
    // await vrfCoordinatorV2Mock.addConsumer(
    //     subscriptionId,
    //     await lotteryContract.getAddress()
    // );


    const checkData = ethers.keccak256(ethers.toUtf8Bytes(""))
    const { upkeepNeeded } = await lotteryContract.checkUpkeep.staticCall(checkData);
    // const { upkeepNeeded } = await lotteryContract.callStatic.checkUpkeep(checkData)
    console.log(`unkeep: ${upkeepNeeded}`)

    if (upkeepNeeded) {
        const tx = await lotteryContract.performUpkeep(checkData)
        const txReceipt = await tx.wait(1)

        // const requestId = txReceipt.events[1].args.requestId
        const requestId = lotteryContract.interface.parseLog(txReceipt.logs[1]).args.requestId;
        // const requestId = 1
        console.log(`Performed upkeep with RequestId: ${requestId}`)

        if (network.config.chainId == 31337) {
            await mockVrf(requestId, lotteryContract)
        }
    } else {
        console.log("No upkeep needed!")
    }
}

async function mockVrf(requestId, lotteryContract) {
    console.log("We on a local network? Ok let's pretend...")

    // const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
    const coordinatorV2 = await deployments.get("VRFCoordinatorV2Mock");
    const vrfCoordinatorV2Mock = await ethers.getContractAt(
        coordinatorV2.abi,
        coordinatorV2.address
    );
    // vrfCoordinatorV2Address = vrfCoordinatorV2Mock.target


    await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, lotteryContract.target)
    console.log("Responded!")
    const recentWinner = await lotteryContract.getWinner()
    console.log(`The winner is: ${recentWinner}`)
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })