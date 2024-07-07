const { ethers } = require("hardhat")

async function enterRaffle() {
    const { deploy, log } = deployments
    const lotteryContract = await ethers.getContractAt(
        "Lottery",
        (await deployments.get("Lottery")).address
    );

    const entranceFee = await lotteryContract.getEntranceFee()
    await lotteryContract.enterLottery({ value: entranceFee })
    console.log("Entered!")
}

enterRaffle()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })