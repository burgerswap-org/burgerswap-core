// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.6;
import './modules/Ownable.sol';
import './interfaces/IDgas.sol';
import './interfaces/IDemaxFactory.sol';
import './interfaces/IERC20.sol';
import './interfaces/IDemaxPair.sol';
import './libraries/DemaxSwapLibrary.sol';
import './libraries/SafeMath.sol';

contract DemaxTransferListener is Ownable {
    using SafeMath for uint;
    uint256 public version = 2;
    address public DGAS;
    address public PLATFORM;
    address public WETH;
    address public FACTORY;
    address public admin;

    mapping(address => uint) public pairWeights;

    event Transfer(address indexed from, address indexed to, address indexed token, uint256 amount);
    event WeightChanged(address indexed pair, uint weight);

    function initialize(
        address _DGAS,
        address _FACTORY,
        address _WETH,
        address _PLATFORM,
        address _admin
    ) external onlyOwner {
        require(
            _DGAS != address(0) && _FACTORY != address(0) && _WETH != address(0) && _PLATFORM != address(0),
            'DEMAX TRANSFER LISTENER : INPUT ADDRESS IS ZERO'
        );
        DGAS = _DGAS;
        FACTORY = _FACTORY;
        WETH = _WETH;
        PLATFORM = _PLATFORM;
        admin = _admin;
    }

    function changeAdmin(address _admin) external onlyOwner {
        admin = _admin;
    }

    function updateDGASImpl(address _newImpl) external onlyOwner {
        IDgas(DGAS).upgradeImpl(_newImpl);
    }

    function updatePairPowers(address[] calldata _pairs, uint[] calldata _weights) external {
        require(msg.sender == admin, 'DEMAX TRANSFER LISTENER: ADMIN PERMISSION');
        require(_pairs.length == _weights.length, "DEMAX TRANSFER LISTENER: INVALID PARAMS");

        for(uint i = 0;i < _weights.length;i++) {
            pairWeights[_pairs[i]] = _weights[i];
            _setProdutivity(_pairs[i]);
            emit WeightChanged(_pairs[i], _weights[i]);
        }
    }

    function upgradeProdutivity(address fromPair, address toPair) external {
        require(msg.sender == PLATFORM, 'DEMAX TRANSFER LISTENER: PERMISSION');
        (uint256 fromPairPower, ) = IDgas(DGAS).getProductivity(fromPair);
        (uint256 toPairPower, ) = IDgas(DGAS).getProductivity(toPair);
        if(fromPairPower > 0 && toPairPower == 0) {
            IDgas(DGAS).decreaseProductivity(fromPair, fromPairPower);
            IDgas(DGAS).increaseProductivity(toPair, fromPairPower);
        }
    }

    function _setProdutivity(address _pair) internal {
        (uint256 lastProdutivity, ) = IDgas(DGAS).getProductivity(_pair);
        address token0 = IDemaxPair(_pair).token0();
        address token1 = IDemaxPair(_pair).token1();
        (uint reserve0, uint reserve1, ) = IDemaxPair(_pair).getReserves();
        uint currentProdutivity = 0;
        if(token0 == DGAS) {
            currentProdutivity = reserve0.mul(pairWeights[_pair]);
        } else if(token1 == DGAS) {
            currentProdutivity = reserve1.mul(pairWeights[_pair]);
        }

        if(lastProdutivity != currentProdutivity) {
            if(lastProdutivity > 0) {
                IDgas(DGAS).decreaseProductivity(_pair, lastProdutivity);
            } 

            if(currentProdutivity > 0) {
                IDgas(DGAS).increaseProductivity(_pair, currentProdutivity);
            }
        }
    }

    function transferNotify(
        address from,
        address to,
        address token,
        uint256 amount
    ) external returns (bool) {
        require(msg.sender == PLATFORM, 'DEMAX TRANSFER LISTENER: PERMISSION');
        if(IDemaxFactory(FACTORY).isPair(from) && token == DGAS) {
            _setProdutivity(from);
        }

        if(IDemaxFactory(FACTORY).isPair(to) && token == DGAS) {
            _setProdutivity(to);
        }

        emit Transfer(from, to, token, amount);
        return true;
    }
}
