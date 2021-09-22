pragma solidity >=0.6.6;

import './libraries/SafeMath.sol';
import './libraries/TransferHelper.sol';
import './modules/ProjectConfigable.sol';

contract DemaxProjectFactory is ProjectConfigable {
    using SafeMath for uint;
    uint public version = 1;
    bool initialized;
    uint public totalWeight;
    
    struct MintStruct {
        uint weight;
        uint amountToMint;
        uint aPerBMinted;
    }
    
    mapping(address => MintStruct) public pools;
    
    address public mintToken;
    uint public mintRate;
    uint public mintTotal;
    uint public amountPerWeight;
    uint public startBlock;
    uint public finishBlock;
    uint public lastUpdateBlock;
    string public intro;
    
    modifier _updateBlock() {
        uint applicableBlock = block.number > finishBlock ? finishBlock: block.number;
        if(totalWeight > 0) {
            amountPerWeight = amountPerWeight.add(applicableBlock.sub(lastUpdateBlock).mul(mintRate).mul(1e18).div(totalWeight));
        }
        lastUpdateBlock = applicableBlock;
        _;
    }
            
    function initialize (address _mintToken, address _admin, string memory _intro) public {
        require(!initialized, 'initialized');
        initialized = true;
        mintToken = _mintToken;
        owner = _admin;
        intro = _intro;
    }
    
    function setWeights(address[] calldata _pools, uint[] calldata _weights) onlyAdmin external _updateBlock {
        require(_pools.length == _weights.length);
        uint cnt = _pools.length;
        for(uint i = 0; i < cnt;i++) {
            _updatePool(_pools[i]);
            totalWeight = totalWeight.sub(pools[_pools[i]].weight);
            pools[_pools[i]].weight = _weights[i];
            totalWeight = totalWeight.add(_weights[i]);
        }
    }
    
    function _updatePool(address pool) internal {
        MintStruct storage record = pools[pool];
        record.amountToMint = record.amountToMint.add(amountPerWeight.sub(record.aPerBMinted).mul(record.weight).div(1e18));
        record.aPerBMinted = amountPerWeight;
    }
    
    function queryPool() external view returns (uint amount) {
        uint applicableBlock = block.number > finishBlock ? finishBlock: block.number;
        uint _amountPerWeight = amountPerWeight;
        if(totalWeight > 0) {
            _amountPerWeight = amountPerWeight.add(applicableBlock.sub(lastUpdateBlock).mul(mintRate).mul(1e18).div(totalWeight));
        }
        
        return pools[msg.sender].amountToMint.add(_amountPerWeight.sub(pools[msg.sender].aPerBMinted).mul(pools[msg.sender].weight).div(1e18));
    }
    
    function mintToPool() external _updateBlock returns (uint amount) {
        _updatePool(msg.sender);
        amount = pools[msg.sender].amountToMint;
        if(amount > 0) {
            TransferHelper.safeTransfer(mintToken, msg.sender, amount);
        }
        pools[msg.sender].amountToMint = 0;
    }
    
    function addReward(uint amount, uint duration) external _updateBlock {
        require(block.number.add(duration) >= finishBlock, "CAN NOT DECREASE DURATION");
        TransferHelper.safeTransferFrom(mintToken, msg.sender, address(this), amount);
        if(block.number > finishBlock) {
            mintRate = amount.div(duration); 
        } else {
            uint remain = finishBlock.sub(block.number).mul(mintRate);
            mintRate = remain.add(amount).div(duration);
        }
        lastUpdateBlock = block.number;
        finishBlock = block.number.add(duration);
        if(startBlock == 0) {
            startBlock = block.number;
        }
        mintTotal = mintTotal.add(amount);
    }
}