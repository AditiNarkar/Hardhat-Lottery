const { assert, expect } = require("chai")
const { devChains, networkConfig } = require("../../helper-hardhat-config")
const { network } = require("hardhat")


// without mocks 
// run only test network - sepolia

devChains.includes(network.name)
    ? describe.skip
    :
    describe("Lottery Staging Tests", () => {
        let lotteryContract, deployer, lotteryEntranceFee
        console.log("Staging Testing...")

        beforeEach(async () => {
            deployer = (await getNamedAccounts()).deployer
            console.log(`deployer: ${deployer}`)
            await deployments.fixture(["all"])

            const myContract = await deployments.get("Lottery");
            lotteryContract = await ethers.getContractAt(
                myContract.abi,
                myContract.address
            )
            
            // put this in etherscan to see contract balance and function calls
            console.log(`myContract Address: ${myContract.address}`)
            // console.log(`lotteryContract Address: ${lotteryContract.target}`) // same as above

            lotteryEntranceFee = await lotteryContract.getEntranceFee()
            console.log(`lotteryEntranceFee: ${lotteryEntranceFee}`)

        })

        describe("fulfillRandomWords", () => {
            it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async () => {
                const startTime = await lotteryContract.getTimeStamp()
                console.log(`startTime: ${startTime}`)

                const accounts = await ethers.getSigners()
                console.log(`accounts: ${accounts}`)

                //set up listener b4 entering lottery -> in case BC moves fast
                await new Promise(async (resolve, reject) => {
                    setTimeout(resolve, 50000)
                    lotteryContract.on("WinnersPicked", async () => {
                        console.log("Event found.")
                        try {
                            const winner = await lotteryContract.getWinner()
                            const lotteryState = await lotteryContract.getLotteryState()
                            const endTime = await lotteryContract.getTimeStamp()
                            const winnerEndBal = await accounts[0].getBalance()

                            console.log(`winner: ${winner}`)
                            console.log(`lotteryState: ${lotteryState}`)
                            console.log(`endTime: ${endTime}`)
                            console.log(`winnerEndBal: ${winnerEndBal}`)
                            console.log(`lotteryContract.getPlayer(0): ${lotteryContract.getPlayer(0)}`)

                            await expect(lotteryContract.getPlayer(0)).to.be.reverted // should be no player
                            assert.equal(winner.toString(), accounts[0].address)
                            assert.equal(lotteryState, 0)
                            assert.equal( 
                                winnerEndBal.toString(), 
                                winnerStartBal.add(lotteryEntranceFee).toString() // only 1 player
                            )
                            assert(endTime > startTime)
                            resolve()
                        }
                        catch (e) {
                            console.log("Staging Expection: ", e)
                            reject()
                        }
                    })

                    await lotteryContract.enterLottery({ value: lotteryEntranceFee })
                    const winnerStartBal = await accounts[0].getBalance()

                })
            })
        })
    })