// File: contracts/libraries/SafeMath.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow
 * checks.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * `SafeMath` restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 */
library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     *
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     *
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts with custom message when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}

// File: contracts/libraries/TransferHelper.sol

// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity >=0.6.0;

// helper methods for interacting with ERC20 tokens and sending ETH that do not consistently return true/false
library TransferHelper {
    function safeApprove(address token, address to, uint value) internal {
        // bytes4(keccak256(bytes('approve(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x095ea7b3, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: APPROVE_FAILED');
    }

    function safeTransfer(address token, address to, uint value) internal {
        // bytes4(keccak256(bytes('transfer(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FAILED');
    }

    function safeTransferFrom(address token, address from, address to, uint value) internal {
        // bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FROM_FAILED');
    }

    function safeTransferETH(address to, uint value) internal {
        (bool success,) = to.call{value:value}(new bytes(0));
        require(success, 'TransferHelper: ETH_TRANSFER_FAILED');
    }
}

// File: contracts/modules/ProjectConfigable.sol

pragma solidity >=0.6.6;

interface IConfig {
    function dev() external view returns (address);
    function admin() external view returns (address);
}

contract ProjectConfigable {
    address public config;
    address public owner;

    constructor() public {
        owner = msg.sender;
    }
    
    function setupConfig(address _config) external onlyOwner {
        config = _config;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, 'OWNER FORBIDDEN');
        _;
    }

    function admin() public view returns(address) {
        if(config != address(0)) {
            return IConfig(config).admin();
        }
        return owner;
    }

    function dev() public view returns(address) {
        if(config != address(0)) {
            return IConfig(config).dev();
        }
        return owner;
    }

    function changeOwner(address _user) external onlyOwner {
        require(owner != _user, 'IFOConfig: NO CHANGE');
        owner = _user;
    }
    
    modifier onlyDev() {
        require(msg.sender == dev() || msg.sender == owner, 'dev FORBIDDEN');
        _;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == admin() || msg.sender == owner, 'admin FORBIDDEN');
        _;
    }
}

// File: contracts/DemaxProjectFactory.sol

pragma solidity >=0.6.6;




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
    
    function mintToPool() external returns (uint amount) {
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
