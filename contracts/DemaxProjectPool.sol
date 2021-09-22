pragma solidity >=0.6.6;

import './libraries/SafeMath.sol';
import './libraries/TransferHelper.sol';

interface IDemaxProjectFactory {
    function mintToPool() external returns (uint amount);
    function queryPool() external view returns (uint amount);
}

interface IDemaxLP {
    function mintReward() external returns (uint amount);
    function queryReward() external view returns (uint);
}

contract DemaxProjectPool {
    using SafeMath for uint;
    uint public version = 1;
    bool initialized;
    uint public totalWeight;
    
    event MintBurger(address indexed user, uint amount);
    event MintReward(address indexed user, uint amount);
    
    struct MintStruct {
        uint amountToMint;
        uint aPerBMinted;
    }

    mapping(address => MintStruct) public rewardInfo;
    mapping(address => MintStruct) public burgerInfo;
    
    mapping(address => uint) public balance;
    
    uint public amountPerBurger;
    uint public amountPerReward;
    
    uint public totalStake;
    
    address public mintToken;
    address public burgerToken;
    address public lpToken;
    
    address public factory;
    
    function initialize (address _mintToken, address _burgerToken, address _lpToken, address _factory) public {
        require(!initialized, 'initialized');
        initialized = true;
        mintToken = _mintToken;
        burgerToken = _burgerToken;
        lpToken = _lpToken;
        factory = _factory;
    }
    
    modifier _update(address user) {
        if(IDemaxLP(lpToken).queryReward() > 0 && totalStake > 0) {
            amountPerBurger = amountPerBurger.add(IDemaxLP(lpToken).mintReward().mul(1e18).div(totalStake));
        }
    
        if(IDemaxProjectFactory(factory).queryPool() > 0 && totalStake > 0) {
            amountPerReward = amountPerReward.add(IDemaxProjectFactory(factory).mintToPool().mul(1e18).div(totalStake));
        }
        
        burgerInfo[user].amountToMint = burgerInfo[user].amountToMint.add(amountPerBurger.sub(burgerInfo[user].aPerBMinted).mul(balance[user]).div(1e18));
        burgerInfo[user].aPerBMinted = amountPerBurger;
        
        rewardInfo[user].amountToMint = rewardInfo[user].amountToMint.add(amountPerReward.sub(rewardInfo[user].aPerBMinted).mul(balance[user]).div(1e18));
        rewardInfo[user].aPerBMinted = amountPerReward;
        _;
    }

    function stake(uint amount) external _update(msg.sender) {
        balance[msg.sender] = balance[msg.sender].add(amount);
        totalStake = totalStake.add(amount);
        TransferHelper.safeTransferFrom(lpToken, msg.sender, address(this), amount);
    }
    
    function withdraw(uint amount) public _update(msg.sender) {
        require(balance[msg.sender] >= amount, "NOT ENOUGH BANLANCE");
        balance[msg.sender] = balance[msg.sender].sub(amount);
        totalStake = totalStake.sub(amount);
        TransferHelper.safeTransfer(lpToken, msg.sender, amount);
    }

    function queryBurger(address _user) external view returns(uint) {
        if(totalStake == 0) {
            return 0;
        } else {
            uint _amountPerBurger = amountPerBurger.add(IDemaxLP(lpToken).queryReward().mul(1e18).div(totalStake));
            return burgerInfo[_user].amountToMint.add(_amountPerBurger.sub(burgerInfo[_user].aPerBMinted).mul(balance[_user]).div(1e18));   
        }
    }
    
    function queryReward(address _user) external view returns(uint) {
        if(totalStake == 0) {
            return 0;
        } else {
            uint _amountPerReward = amountPerReward.add(IDemaxProjectFactory(factory).queryPool().mul(1e18).div(totalStake));
            return rewardInfo[_user].amountToMint.add(_amountPerReward.sub(rewardInfo[_user].aPerBMinted).mul(balance[_user]).div(1e18));
        }
    }
    
    function _mintBurger() internal returns(uint amount) {
        amount = burgerInfo[msg.sender].amountToMint;
        if(amount > 0) {
            TransferHelper.safeTransfer(burgerToken, msg.sender, amount);
            burgerInfo[msg.sender].amountToMint = 0;
            emit MintBurger(msg.sender, amount);
        }
        return amount;
    }
    
    function _mintReward() internal returns(uint amount) {
        amount = rewardInfo[msg.sender].amountToMint;
        if(amount > 0) {
            TransferHelper.safeTransfer(mintToken, msg.sender, amount);
            rewardInfo[msg.sender].amountToMint = 0;
            emit MintReward(msg.sender, amount);
        }
        return amount;
    }

    function mintBurger() external _update(msg.sender) returns(uint amount) {
        return _mintBurger();
    }
    
    function mintReward() external _update(msg.sender) returns(uint amount) {
        return _mintReward();
    }

    function mintAll() public _update(msg.sender) returns(uint, uint) {
        return (_mintBurger(), _mintReward());
    }
    
    function exit() external _update(msg.sender) {
        _mintBurger();
        _mintReward();
        withdraw(balance[msg.sender]);
    }
}