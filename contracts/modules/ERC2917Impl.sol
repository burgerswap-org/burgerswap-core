 //SPDX-License-Identifier: MIT
pragma solidity >=0.6.6;

import '../interfaces/ERC2917-Interface.sol';
import '../modules/Upgradable.sol';
import '../libraries/SafeMath.sol';

/*
    The Objective of ERC2917 Demo is to implement a decentralized staking mechanism, which calculates users' share
    by accumulating productiviy * time. And calculates users revenue from anytime t0 to t1 by the formula below:

        user_accumulated_productivity(time1) - user_accumulated_productivity(time0)
       _____________________________________________________________________________  * (gross_product(t1) - gross_product(t0))
       total_accumulated_productivity(time1) - total_accumulated_productivity(time0)

*/
contract ERC2917Impl is IERC2917, UpgradableProduct, UpgradableGovernance {
    using SafeMath for uint;

    uint public mintCumulation;
    uint public amountPerBlock;

    // implementation of ERC20 interfaces.
    string override public name;
    string override public symbol;
    uint8 override public decimals = 18;
    uint override public totalSupply;

    mapping(address => uint) override public balanceOf;
    mapping(address => mapping(address => uint)) override public allowance;

    function _transfer(address from, address to, uint value) internal virtual {
        require(balanceOf[from] >= value, 'ERC20Token: INSUFFICIENT_BALANCE');
        balanceOf[from] = balanceOf[from].sub(value);
        balanceOf[to] = balanceOf[to].add(value);
        if (to == address(0)) { // burn
            totalSupply = totalSupply.sub(value);
        }
        emit Transfer(from, to, value);
    }

    function approve(address spender, uint value) external virtual override  returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint value) external virtual override returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint value) external virtual override returns (bool) {
        require(allowance[from][msg.sender] >= value, 'ERC20Token: INSUFFICIENT_ALLOWANCE');
        allowance[from][msg.sender] = allowance[from][msg.sender].sub(value);
        _transfer(from, to, value);
        return true;
    }

    // end of implementation of ERC20
    
    uint lastRewardBlock;
    uint totalProductivity;
    uint accAmountPerShare;
    struct UserInfo {
        uint amount;     // How many LP tokens the user has provided.
        uint rewardDebt; // Reward debt. 
        uint rewardEarn; // Reward earn and not minted
    }

    mapping(address => UserInfo) public users;

    // creation of the interests token.
    constructor(string memory _name, string memory _symbol, uint8 _decimals, uint _interestsRate) UpgradableProduct() UpgradableGovernance() public {
        name        = _name;
        symbol      = _symbol;
        decimals    = _decimals;

        amountPerBlock = _interestsRate;
    }

    // External function call
    // This function adjust how many token will be produced by each block, eg:
    // changeAmountPerBlock(100)
    // will set the produce rate to 100/block.
    function changeInterestRatePerBlock(uint value) external virtual override requireGovernor returns (bool) {
        uint old = amountPerBlock;
        require(value != old, 'AMOUNT_PER_BLOCK_NO_CHANGE');

        _update();
        amountPerBlock = value;

        emit InterestRatePerBlockChanged(old, value);
        return true;
    }

    // Update reward variables of the given pool to be up-to-date.
    function _update() internal virtual {
        if (block.number <= lastRewardBlock) {
            return;
        }

        if (totalProductivity == 0) {
            lastRewardBlock = block.number;
            return;
        }
        
        uint256 reward = _currentReward();
        balanceOf[address(this)] = balanceOf[address(this)].add(reward);
        totalSupply = totalSupply.add(reward);

        accAmountPerShare = accAmountPerShare.add(reward.mul(1e12).div(totalProductivity));
        lastRewardBlock = block.number;
    }
    
    function _currentReward() internal virtual view returns (uint){
        uint256 multiplier = block.number.sub(lastRewardBlock);
        return multiplier.mul(amountPerBlock);
    }
    
    // Audit user's reward to be up-to-date
    function _audit(address user) internal virtual {
        UserInfo storage userInfo = users[user];
        if (userInfo.amount > 0) {
            uint pending = userInfo.amount.mul(accAmountPerShare).div(1e12).sub(userInfo.rewardDebt);
            userInfo.rewardEarn = userInfo.rewardEarn.add(pending);
            mintCumulation = mintCumulation.add(pending);
            userInfo.rewardDebt = userInfo.amount.mul(accAmountPerShare).div(1e12);
        }
    }

    // External function call
    // This function increase user's productivity and updates the global productivity.
    // the users' actual share percentage will calculated by:
    // Formula:     user_productivity / global_productivity
    function increaseProductivity(address user, uint value) external virtual override requireImpl returns (bool) {
        require(value > 0, 'PRODUCTIVITY_VALUE_MUST_BE_GREATER_THAN_ZERO');

        UserInfo storage userInfo = users[user];
        _update();
        _audit(user);

        totalProductivity = totalProductivity.add(value);

        userInfo.amount = userInfo.amount.add(value);
        userInfo.rewardDebt = userInfo.amount.mul(accAmountPerShare).div(1e12);
        emit ProductivityIncreased(user, value);
        return true;
    }

    // External function call 
    // This function will decreases user's productivity by value, and updates the global productivity
    // it will record which block this is happenning and accumulates the area of (productivity * time)
    function decreaseProductivity(address user, uint value) external virtual override requireImpl returns (bool) {
        UserInfo storage userInfo = users[user];
        require(value > 0 && userInfo.amount >= value, "INSUFFICIENT_PRODUCTIVITY");
        _update();
        _audit(user);
        
        userInfo.amount = userInfo.amount.sub(value);
        userInfo.rewardDebt = userInfo.amount.mul(accAmountPerShare).div(1e12);
        totalProductivity = totalProductivity.sub(value);

        emit ProductivityDecreased(user, value);
        return true;
    }
    
    function takeWithAddress(address user) public view returns (uint) {
        UserInfo storage userInfo = users[user];
        uint _accAmountPerShare = accAmountPerShare;
        // uint256 lpSupply = totalProductivity;
        if (block.number > lastRewardBlock && totalProductivity != 0) {
            uint reward = _currentReward();
            _accAmountPerShare = _accAmountPerShare.add(reward.mul(1e12).div(totalProductivity));
        }
        return userInfo.amount.mul(_accAmountPerShare).div(1e12).sub(userInfo.rewardDebt).add(userInfo.rewardEarn);
    }

    function take() external override virtual view returns (uint) {
        return takeWithAddress(msg.sender);
    }

    // Returns how much a user could earn plus the giving block number.
    function takeWithBlock() external override virtual view returns (uint, uint) {
        uint earn = takeWithAddress(msg.sender);
        return (earn, block.number);
    }


    // External function call
    // When user calls this function, it will calculate how many token will mint to user from his productivity * time
    // Also it calculates global token supply from last time the user mint to this time.
    function mint() external override virtual returns (uint) {
        _update();
        _audit(msg.sender);
        require(users[msg.sender].rewardEarn > 0, "NO_PRODUCTIVITY");
        uint amount = users[msg.sender].rewardEarn;
        _transfer(address(this), msg.sender, users[msg.sender].rewardEarn);
        users[msg.sender].rewardEarn = 0;
        return amount;
    }

    // Returns how many productivity a user has and global has.
    function getProductivity(address user) external override virtual view returns (uint, uint) {
        return (users[user].amount, totalProductivity);
    }

    // Returns the current gorss product rate.
    function interestsPerBlock() external override virtual view returns (uint) {
        return accAmountPerShare;
    }
}
