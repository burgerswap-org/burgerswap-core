// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.6;

import './DemaxPair.sol';
import './interfaces/IDemaxConfig.sol';

contract DemaxFactory {
    uint256 public version = 1;
    address public DGAS;
    address public CONFIG;
    address public owner;
    mapping(address => mapping(address => address)) public getPair;
    mapping(address => bool) public isPair;
    address[] public allPairs;

    mapping(address => address[]) public playerPairs;
    mapping(address => mapping(address => bool)) isAddPlayerPair;

    bytes32 public contractCodeHash;
    event PairCreated(address indexed token0, address indexed token1, address pair, uint256);

    constructor(address _DGAS, address _CONFIG) public {
        DGAS = _DGAS;
        CONFIG = _CONFIG;
        owner = msg.sender;
    }

    function updateConfig(address _CONFIG) external {
        require(msg.sender == owner, 'DEMAX FACTORY: PERMISSION');
        CONFIG = _CONFIG;
        for(uint i = 0; i < allPairs.length; i ++) {
            DemaxPair(allPairs[i]).initialize(DemaxPair(allPairs[i]).token0(), DemaxPair(allPairs[i]).token1(), _CONFIG, DGAS);
        }
    }

    function getPlayerPairCount(address player) external view returns (uint256) {
        address[] storage existAddress = playerPairs[player];
        return existAddress.length;
    }

    function addPlayerPair(address _player, address _pair) external returns (bool) {
        require(msg.sender == IDemaxConfig(CONFIG).platform(), 'DEMAX FACTORY: PERMISSION');
        if (isAddPlayerPair[_player][_pair] == false) {
            isAddPlayerPair[_player][_pair] = true;
            playerPairs[_player].push(_pair);
        }
        return true;
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(msg.sender == IDemaxConfig(CONFIG).platform(), 'DEMAX FACTORY: PERMISSION');
        require(tokenA != tokenB, 'DEMAX FACTORY: IDENTICAL_ADDRESSES');
        require(
            IDemaxConfig(CONFIG).checkToken(tokenA) && IDemaxConfig(CONFIG).checkToken(tokenB),
            'DEMAX FACTORY: NOT LIST'
        );
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'DEMAX FACTORY: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'DEMAX FACTORY: PAIR_EXISTS'); // single check is sufficient
        bytes memory bytecode = type(DemaxPair).creationCode;
        if (uint256(contractCodeHash) == 0) {
            contractCodeHash = keccak256(bytecode);
        }
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        isPair[pair] = true;
        DemaxPair(pair).initialize(token0, token1, CONFIG, DGAS);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }
}
