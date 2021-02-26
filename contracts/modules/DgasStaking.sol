pragma solidity >=0.5.16;

import '../libraries/TransferHelper.sol';
import '../libraries/SafeMath.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/IDemaxConfig.sol';
import '../modules/BaseToken.sol';


contract DgasStaking is BaseToken {
    using SafeMath for uint;

    uint public lockTime;
    uint public totalSupply;
    uint public stakingSupply;
    mapping(address => uint) public balanceOf;
    mapping(address => uint) public allowance;


    constructor (address _baseToken) public {
        initBaseToken(_baseToken);
    }

    function _add(address user, uint value) internal {
        require(value > 0, 'ZERO');
        balanceOf[user] = balanceOf[user].add(value);
        stakingSupply = stakingSupply.add(value);
        allowance[user] = block.number;
    }

    function _reduce(address user, uint value) internal {
        require(balanceOf[user] >= value && value > 0, 'DgasStaking: INSUFFICIENT_BALANCE');
        balanceOf[user] = balanceOf[user].sub(value);
        stakingSupply = stakingSupply.sub(value);
    }
    
    function _reset(address user) internal {
        allowance[user] = block.number;
    }

    function deposit(uint _amount) external returns (bool) {
        TransferHelper.safeTransferFrom(baseToken, msg.sender, address(this), _amount);
        _add(msg.sender, _amount);
        totalSupply = IERC20(baseToken).balanceOf(address(this));
        return true;
    }

    function withdraw(uint _amount) external returns (bool) {
        require(block.number > allowance[msg.sender] + lockTime, 'DgasStaking: NOT_DUE');
        TransferHelper.safeTransfer(baseToken, msg.sender, _amount);
        _reduce(msg.sender, _amount);
        totalSupply = IERC20(baseToken).balanceOf(address(this));
        return true;
    }

}