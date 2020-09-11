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

    function transferNotify(
        address from,
        address to,
        address token,
        uint256 amount
    ) external returns (bool) {
        require(msg.sender == PLATFORM, 'DEMAX TRANSFER LISTENER: PERMISSION');
        if (token == WETH) {
            if (IDemaxFactory(FACTORY).isPair(from)) {
                uint256 decreasePower = IDemaxFactory(FACTORY).getPair(DGAS, WETH) == from
                    ? SafeMath.mul(amount, 2)
                    : amount;
                IDgas(DGAS).decreaseProductivity(from, decreasePower);
            }
            if (IDemaxFactory(FACTORY).isPair(to)) {
                uint256 increasePower = IDemaxFactory(FACTORY).getPair(DGAS, WETH) == to
                    ? SafeMath.mul(amount, 2)
                    : amount;
                IDgas(DGAS).increaseProductivity(to, increasePower);
            }
        } else if (token == DGAS) {
            (uint256 reserveDGAS, uint256 reserveWETH) = DemaxSwapLibrary.getReserves(FACTORY, DGAS, WETH);
            if (IDemaxFactory(FACTORY).isPair(to) && IDemaxFactory(FACTORY).getPair(DGAS, WETH) != to) {
                IDgas(DGAS).increaseProductivity(to, DemaxSwapLibrary.quote(amount, reserveDGAS, reserveWETH));
            }
            if (IDemaxFactory(FACTORY).isPair(from) && IDemaxFactory(FACTORY).getPair(DGAS, WETH) != from) {
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
