const { ethers } = require("hardhat")

const networkConfig = {
    // 31337:{
    //     name: "localhost",
    //     blockConfirmations: 1,
    //     entranceFee: ethers.parseEther("0.01"),
    //     keyHash: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae",
    //     callbackGasLimit: "500000",
    //     interval: "30"
    // },
    31337: {
        name: "hardhat",
        entranceFee: ethers.parseEther("0.01"),
        keyHash: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae",
        callbackGasLimit: "500000",
        interval: "30"
    },
    11155111: {
        //from https://docs.chain.link/vrf/v2-5/supported-networks in Sepolia network
        name: "sepolia",
        vrfCoordinatorV2: "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B",
        entranceFee: ethers.parseEther("0.01"),
        keyHash: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae",
        subscription_Id: "11848", // from remix
        callbackGasLimit: "500000",
        interval: "30"
    },
    
}

// chains that mocks are goin to be deployed on
const devChains = ["hardhat", "localhost"]

module.exports = {
    networkConfig, devChains
}