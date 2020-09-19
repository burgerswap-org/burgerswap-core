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
    uint256 public version = 1;
    address public DGAS;
    address public PLATFORM;
    address public WETH;
    address public FACTORY;

    mapping(address => bool) public tokenWhitelist;
    mapping(address => bool) public disablePairlist;

    event Transfer(address indexed from, address indexed to, address indexed token, uint256 amount);

    function initialize(
        address _DGAS,
        address _FACTORY,
        address _WETH,
        address _PLATFORM
    ) external onlyOwner {
        require(
            _DGAS != address(0) && _FACTORY != address(0) && _WETH != address(0) && _PLATFORM != address(0),
            'DEMAX TRANSFER LISTENER : INPUT ADDRESS IS ZERO'
        );
        DGAS = _DGAS;
        FACTORY = _FACTORY;
        WETH = _WETH;
        PLATFORM = _PLATFORM;
    }

    function updateDGASImpl(address _newImpl) external onlyOwner {
        IDgas(DGAS).upgradeImpl(_newImpl);
    }

    // added for emergency remove scam tokens.
    function setWhitelist(bool _active, address[] memory _tokens) public onlyOwner {
        for(uint i = 0; i < _tokens.length; i ++) {
            tokenWhitelist[_tokens[i]] = _active;
        }
    }

    function setDisablePairlist(bool _active, address[] memory _pairs) public onlyOwner {
        for(uint i = 0; i < _pairs.length; i ++) {
            disablePairlist[_pairs[i]] = _active;
        }
    }

    function emergencyRemoveProductivity(address _pair, uint _amount) public onlyOwner {
        require(IDemaxFactory(FACTORY).isPair(_pair), "DEMAX TRANSFER LISTENER: ILLEGAL ADDRESS");
        address token0  = IDemaxPair(_pair).token0();
        address token1  = IDemaxPair(_pair).token1();
        require(tokenWhitelist[token0] == false || tokenWhitelist[token1] == false, "DEMAX TRANSFER LISTENER: ILLEGAL");
        IDgas(DGAS).decreaseProductivity(_pair, _amount);
    }

    // only white listed token will calculate for procutivity.
    function _hasProductivity(address _pair) internal view returns (bool) {
        if(IDemaxFactory(FACTORY).isPair(_pair)) {
            address token0  = IDemaxPair(_pair).token0();
            address token1  = IDemaxPair(_pair).token1();
            if(disablePairlist[_pair] == false && tokenWhitelist[token0] == true && tokenWhitelist[token1] == true)
                return true;
        }
        return false;
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

    function transferNotify(
        address from,
        address to,
        address token,
        uint256 amount
    ) external returns (bool) {
        require(msg.sender == PLATFORM, 'DEMAX TRANSFER LISTENER: PERMISSION');

        if (token == WETH) {
            if (_hasProductivity(from)) {
                uint256 decreasePower = IDemaxFactory(FACTORY).getPair(DGAS, WETH) == from
                    ? SafeMath.mul(amount, 2)
                    : amount;
                IDgas(DGAS).decreaseProductivity(from, decreasePower);
            }
            if (_hasProductivity(to)) {
                uint256 increasePower = IDemaxFactory(FACTORY).getPair(DGAS, WETH) == to
                    ? SafeMath.mul(amount, 2)
                    : amount;
                IDgas(DGAS).increaseProductivity(to, increasePower);
            }

        } else if (token == DGAS) {
            (uint256 reserveDGAS, uint256 reserveWETH) = DemaxSwapLibrary.getReserves(FACTORY, DGAS, WETH);
            if (_hasProductivity(to) && IDemaxFactory(FACTORY).getPair(DGAS, WETH) != to) {
                IDgas(DGAS).increaseProductivity(to, DemaxSwapLibrary.quote(amount, reserveDGAS, reserveWETH));
            }
            if (_hasProductivity(from) && IDemaxFactory(FACTORY).getPair(DGAS, WETH) != from) {
                (uint256 pairPower, ) = IDgas(DGAS).getProductivity(from);
                uint256 balance = IDemaxPair(from).getDGASReserve();
                uint256 decrasePower = (SafeMath.mul(amount, pairPower)) / (SafeMath.add(balance, amount));
                if (decrasePower > 0) IDgas(DGAS).decreaseProductivity(from, decrasePower);
            }
        }
        emit Transfer(from, to, token, amount);
        return true;
    }
}
