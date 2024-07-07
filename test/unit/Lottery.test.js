const { assert, expect } = require("chai")
const { devChains, networkConfig } = require("../../helper-hardhat-config")
const { network } = require("hardhat")

!devChains.includes(network.name)
    ? describe.skip
    :
    describe("Lottery Unit Tests", () => {
        let lotteryContract, vrfCoordinatorV2Mock, deployer, lotteryEntranceFee, interval
        const chainId = network.config.chainId

        beforeEach(async () => {
            deployer = (await getNamedAccounts()).deployer
            await deployments.fixture(["all"])

            const myContract = await deployments.get("Lottery");
            lotteryContract = await ethers.getContractAt(
                myContract.abi,
                myContract.address
            )

            const myMockContract = await deployments.get("VRFCoordinatorV2Mock");
            vrfCoordinatorV2Mock = await ethers.getContractAt(
                myMockContract.abi,
                myMockContract.address
            )

            lotteryEntranceFee = await lotteryContract.getEntranceFee()
            interval = await lotteryContract.getInterval()
        })

        describe("constructor", () => {
            it("initializes lottery", async () => {
                const lotteryState = await lotteryContract.getLotteryState()
                assert.equal(lotteryState.toString(), "0")

                const interval = await lotteryContract.getInterval()
                assert.equal(interval.toString(), networkConfig[chainId]["interval"])
            })
        })

        describe("enterLottery", async () => {
            it("reverts when not enought ETH", async () => {
                // to.be.revertedWithCustomError(contractInstance, NameOfTheCustomError). 
                // Also if the custom error have args you can add .withArgs(..args)
                await expect(lotteryContract.enterLottery()).to.be.revertedWithCustomError(lotteryContract, "Lottery__NotEnoughETH")
            })

            it("records players when they enter", async () => {
                await lotteryContract.enterLottery({ value: lotteryEntranceFee })
                const playerFromContract = await lotteryContract.getPlayer(0)
                assert.equal(playerFromContract, deployer)
            })

            it("emits event on enter", async () => {
                await expect(lotteryContract.enterLottery({ value: lotteryEntranceFee })).to.emit(lotteryContract, "LotteryEnter")
            })

            it("only allows to enter when open and not calculating", async () => {
                await lotteryContract.enterLottery({ value: lotteryEntranceFee })
                // https://hardhat.org/hardhat-network/docs/reference#evm_increasetime
                await network.provider.send("evm_increaseTime", [Number(interval) + 1]) // to return upKeep true for checkUpkeep() and make timePassed bool var true.
                await network.provider.send("evm_mine", [])

                // pretend to be chainlink keeper
                await lotteryContract.performUpkeep("0x")
                // now contract is in CALCULAITNG state

                await expect(lotteryContract.enterLottery({ value: lotteryEntranceFee })).to.be.revertedWithCustomError(lotteryContract, "Lottery__NotOpen")
            })
        })

        describe("checkUpkeep", () => {
            it("returns false if no ETH", async () => {
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])

                //staticCall -> simulate calling rather than calling function
                const { upkeepNeeded } = await lotteryContract.checkUpkeep.staticCall("0x");
                assert(!upkeepNeeded)
            })

            it("returns false if lottery is NOT OPEN ", async () => {
                await lotteryContract.enterLottery({ value: lotteryEntranceFee })

                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])

                await lotteryContract.performUpkeep("0x")
                const lotteryState = await lotteryContract.getLotteryState()
                assert.equal(lotteryState.toString(), "1")

                const { upkeepNeeded } = await lotteryContract.checkUpkeep.staticCall("0x");
                assert.equal(upkeepNeeded, false)
            })

            it("returns false if enough time hasn't passed", async () => {
                await lotteryContract.enterLottery({ value: lotteryEntranceFee })
                await network.provider.send("evm_increaseTime", [Number(interval) - 5]) // use a higher number here if this test fails
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await lotteryContract.checkUpkeep.staticCall("0x");
                // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(!upkeepNeeded)
            })
            it("returns true if enough time has passed, has players, eth, and is open", async () => {
                await lotteryContract.enterLottery({ value: lotteryEntranceFee })
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await lotteryContract.checkUpkeep.staticCall("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(upkeepNeeded)
            })

        })

        describe("performUpkeep", function () {
            it("updates the lottery state and emits a requestId", async () => {
                await lotteryContract.enterLottery({ value: lotteryEntranceFee })

                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.request({ method: "evm_mine", params: [] })

                const txResponse = await lotteryContract.performUpkeep("0x") // emits requestId
                const txReceipt = await txResponse.wait(1) // waits 1 block

                const lotteryState = await lotteryContract.getLotteryState() // updates state
                const requestId = txReceipt.logs[1].args.requestId // 1 becoz previous code also emits event

                assert(Number(requestId) > 0)
                assert(lotteryState == 1) // 0 = open, 1 = calculating
            })
        })

            // 0xbC50d8acDf1B43D1c2C56711A9eA3df5fF37D28d - address of Mock Contract

        describe("fulfillRandomWords", function () {
            beforeEach(async () => {
                await lotteryContract.enterLottery({ value: lotteryEntranceFee })
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
            })

            it("can only be called after performupkeep", async () => {

                // 0 and 1 are requestId
                await expect(
                    vrfCoordinatorV2Mock.fulfillRandomWords(0, lotteryContract.target) // reverts if not fulfilled
                ).to.be.revertedWith("nonexistent request")

                await expect(
                    vrfCoordinatorV2Mock.fulfillRandomWords(1, lotteryContract.target) // reverts if not fulfilled
                ).to.be.revertedWith("nonexistent request")
            })

            // combined test
            it("picks a winner, resets lottery and sends money", async () => {
                const players = 3
                const startingPlayer = 1 // deployer is 0
                const accounts = await ethers.getSigners()

                for (let i = startingPlayer; i < startingPlayer + players; i++){
                    const connectedAcc = lotteryContract.connect(accounts[i])
                    await connectedAcc.enterLottery({ value: lotteryEntranceFee })
                }

                const startTime = await lotteryContract.getTimeStamp()

                // performUpkeep (mock being Chainlink Keeper)
                // fulfillRandomWords (mock being Chainlink VRF)
                // simulate wiating for fulfillRandomWords to be called -> using Listener and Promise

                await new Promise(async (resolve, reject) => {
                    // listen once for WinnersPicked EVENT declared in contract
                    setTimeout(resolve, 2000)
                    lotteryContract.on("WinnersPicked", async () => { // should be within mocha timeout interval i.e. 200 secs
                        console.log("Event found.")
                        try{
                            const winner = await lotteryContract.getWinner()
                            const lotteryState = await lotteryContract.getLotteryState()
                            const endTime = await lotteryContract.getTimeStamp()
                            const playerCount = await lotteryContract.getPlayerCount()
                            const winnerEndBal = await accounts[1].getBalance()


                            assert(playerCount.toString(), "0")
                            assert(lotteryState.toString, "0")
                            assert(endTime > startTime)

                            console.log(`Winner: ${winner}`)

                            console.log("Players: ")
                            for (let i = startingPlayer; i < startingPlayer + players; i++){
                                console.log(`${i} -> ${accounts[i].address}`)
                            }

                            // for money transfers
                            assert.equal(winnerEndBal.toString(), 
                                winnerStartBal.add(
                                    lotteryEntranceFee
                                    .mul(players)
                                    .add(lotteryEntranceFee)
                                    .toString()
                                ))
                        }
                        catch(e){
                            console.log(e)
                            reject()
                        }
                        resolve()
                    })
                    // fire event to listen and resolve
                    const tx = await lotteryContract.performUpkeep("0x")
                    const txReceipt = await tx.wait(1)

                    const winnerStartBal = await accounts[1].getBalance()

                    await vrfCoordinatorV2Mock.fulfillRandomWords(
                        txReceipt.logs[1].args.requestId, 
                        lotteryContract.target
                    )
                })
            })
        })

    })
