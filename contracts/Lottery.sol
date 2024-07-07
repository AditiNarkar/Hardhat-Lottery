// enter lottery (pay amount)
// select a random verifiable winner
// loop selection every X mins -> automatic triggers

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

// import {VRFConsumerBaseV2} from "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
// import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
// import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

import {VRFConsumerBaseV2} from "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
//import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

//errors
error Lottery__NotEnoughETH();
error Lottery__TransferFailed();
error Lottery__NotOpen();
error Lottery__UpkeepNotNeeded(uint256 current_balance, uint256 playerCount, uint256 lotteryState);


contract Lottery is VRFConsumerBaseV2, KeeperCompatibleInterface {

    // type Declarations
    enum LotteryState{
        OPEN, CALCULATING
    } // uint256 0 = OPEN, 1 = CALCULATING

    // State Variables
    uint256 private immutable i_entranceFee;
    address payable[] private s_players; // frequently mutating storage variable // payable->if player wins
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_keyHash;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    //Lottery Variables
    address private s_winner;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    
    // uint256 private s_state; // pending, open, closed, calculating
    LotteryState private s_lotteryState; // enum

    //events
    event LotteryEnter(address indexed player);
    event RequestedLotteryWinner(uint256 indexed requestId);
    event WinnersPicked(address indexed allWinners);

    // by inheriting from this base contract VRFConsumerBaseV2, this smart contract gains access to the functionality required to interact with Chainlink VRF.
    constructor(
        address vrfCoordinatorV2, // contract
        uint256 entranceFee,
        bytes32 keyHash,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_keyHash = keyHash;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_lotteryState = LotteryState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterLottery() public payable {
        // require(msg.value > i_entranceFee, "Not enought ETH!")

        // More gas efficient approach is to do error codes
        if (msg.value < i_entranceFee) {
            revert Lottery__NotEnoughETH();
        }

        if(s_lotteryState != LotteryState.OPEN){ 
            revert Lottery__NotOpen(); 
        }
        s_players.push(payable(msg.sender));
        emit LotteryEnter(msg.sender); // emit event when we make a mapping
    }


    // 2 transaction process
    // 1. request random num
    // 2. do something with it

/*
    look for `upkeepNeeded` to return True.
    the following should be true for this to return true:
    1. Time interval has passed between runs.
    2. The lottery is "open" state and has atleast 1 player.
    3. The contract has ETH.
    4. Our subscription is funded with LINK.
*/
    // call requestWinner on loop
    function checkUpkeep(bytes memory /* checkData */)
        public
        override
        returns (bool upkeepNeeded, bytes memory /* performData */ )
    {
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool isOpen = (LotteryState.OPEN == s_lotteryState);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (timePassed && isOpen && hasPlayers && hasBalance);
    }

    /*
     Once `checkUpkeep` is returning `true`, this function is called
     and it kicks off a Chainlink VRF call to get a random winner.
    */

    // external functions are cheaper as contracts itself cant call them, Keeper will

    function performUpkeep(bytes calldata /* checkData */) external  override{

        (bool upkeepNeeded, ) = checkUpkeep("");
        if(!upkeepNeeded){
            revert Lottery__UpkeepNotNeeded(
                address(this).balance, s_players.length, uint256(s_lotteryState)
            );
        }

        s_lotteryState = LotteryState.CALCULATING;
        
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_keyHash, // gasLane -> maximum gas price you are willing to pay for a request in wei
            i_subscriptionId, // subscription ID that this contract uses for funding requests
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit, // limit for how much gas to use for the callback request to fulfillRandomWords()
            NUM_WORDS // how many random numbers we want
        );
        emit RequestedLotteryWinner(requestId);
    }

    function fulfillRandomWords(
        uint256 /*requestId*/,
        uint256[] memory randomWords
    ) internal override {
        s_lotteryState = LotteryState.OPEN;

        // randomWords is array of size 1 with 256 long digits
        // modulo operation helps in getting random winner from players array
        uint256 winnerIndex = randomWords[0] % s_players.length; // eg. 202 % 10 = 2
        address payable winnerAddress = s_players[winnerIndex];
        s_winner = winnerAddress;
        s_players = new address payable[](0); // discard all players array
        s_lastTimeStamp = block.timestamp;

        // paying winner -> call is used to transfer money to winnerAddress
        (bool success, ) = winnerAddress.call{value: address(this).balance}("");
        if (!success) {
            revert Lottery__TransferFailed();
        }
        emit WinnersPicked(winnerAddress);
    }

    // getters
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 i) public view returns (address) {
        return s_players[i];
    }

    function getWinner() public view returns (address) {
        return s_winner;
    }

    function getLotteryState() public view returns (LotteryState) {
        return s_lotteryState;
    }

    function getNumWords() public pure returns(uint256){ 
        // view reads storage vars, pure reads constants
        return NUM_WORDS;
    }

    function getReqConfirmations() public pure returns(uint256){
        return REQUEST_CONFIRMATIONS;
    }

    function getPlayerCount() public view returns(uint256){
        return s_players.length;
    }

    function getTimeStamp() public view returns(uint256){
        return s_lastTimeStamp;
    }

    function getInterval() public view returns(uint256){
        return i_interval;
    }

}
