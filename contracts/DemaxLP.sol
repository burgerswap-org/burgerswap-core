pragma solidity >=0.6.6;

import './libraries/SafeMath.sol';
import './modules/BaseShareField.sol';

interface IDemaxPool {
    function queryReward(address _pair, address _user) external view returns(uint);
    function claimReward(address _pair, address _rewardToken) external;
}

interface IDemaxPair {
    function queryReward() external view returns (uint256 rewardAmount, uint256 blockNumber);
    function mintReward() external returns (uint256 userReward);
}

interface IDemaxDelegate {
    function getPair(address tokenA, address tokenB) external view returns(address);
    function addPlayerPair(address _user) external;
}

interface IDemaxPlatform{
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 amountAMin,
        uint256 amountBMin,
        uint256 deadline
    )
        external
        returns (
            uint256 _amountA,
            uint256 _amountB,
            uint256 _liquidity
        );
        
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        uint256 deadline
    )
        external
        payable
        returns (
            uint256 _amountToken,
            uint256 _amountETH,
            uint256 _liquidity
        );
    function removeLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountToken, uint256 amountETH);
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
    
    function pairFor(address tokenA, address tokenB) external view returns (address);
}

contract DemaxLP is BaseShareField {
    // ERC20 Start
    
    using SafeMath for uint;

    string public constant name = 'Burger LP';
    string public constant symbol = 'BLP';
    uint8 public constant decimals = 18;
    uint public totalSupply;
    
    mapping(address => uint) public balanceOf;
    mapping(address => mapping(address => uint)) public allowance;

    event Mint(address indexed user, uint amount);
    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
    
    function _mint(address to, uint value) internal {
        totalSupply = totalSupply.add(value);
        balanceOf[to] = balanceOf[to].add(value);
        emit Transfer(address(0), to, value);
    }
    
    receive() external payable {
    }
    
    function _burn(address from, uint value) internal {
        balanceOf[from] = balanceOf[from].sub(value);
        totalSupply = totalSupply.sub(value);
        emit Transfer(from, address(0), value);
    }

    function _transfer(address from, address to, uint value) private {
        require(balanceOf[from] >= value, 'ERC20Token: INSUFFICIENT_BALANCE');
        balanceOf[from] = balanceOf[from].sub(value);
        balanceOf[to] = balanceOf[to].add(value);
        if (to == address(0)) { // burn
            totalSupply = totalSupply.sub(value);
        }

        IDemaxDelegate(owner).addPlayerPair(to);
        _mintReward();
        _decreaseProductivity(from, value);
        _increaseProductivity(to, value);
        emit Transfer(from, to, value);
    }

    function approve(address spender, uint value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint value) external returns (bool) {
        require(allowance[from][msg.sender] >= value, 'ERC20Token: INSUFFICIENT_ALLOWANCE');
        allowance[from][msg.sender] = allowance[from][msg.sender].sub(value);
        _transfer(from, to, value);
        return true;
    }    
    
    // ERC20 End
    
    
    address public owner;
    address public POOL;
    address public PLATFORM;
    address public tokenA;
    address public tokenB;
    address public WETH;
    
    event AddLiquidity (address indexed user, uint amountA, uint amountB, uint value);
    event RemoveLiquidity (address indexed user, uint amountA, uint amountB, uint value);
    
    constructor() public {
        owner = msg.sender;
    }
    
    function initialize(address _tokenA, address _tokenB, address _DGAS, address _POOL, address _PLATFORM, address _WETH) external {
        require(msg.sender == owner, "Demax LP Forbidden");
        tokenA = _tokenA;
        tokenB = _tokenB;
        _setShareToken(_DGAS);
        PLATFORM = _PLATFORM;
        POOL = _POOL;
        WETH = _WETH;
    }
 
    function upgrade(address _PLATFORM) external {
        require(msg.sender == owner, "Demax LP Forbidden");
        PLATFORM = _PLATFORM;
    }

    function approveContract(address token, address spender, uint amount) internal {
        uint allowAmount = IERC20(token).totalSupply();
        if(allowAmount < amount) {
            allowAmount = amount;
        }

        uint _allowance = IERC20(token).allowance(address(this), spender);
        if(_allowance < amount) {
            if(_allowance > 0) {
                TransferHelper.safeApprove(token, spender, 0); // workaround for usdt approve
            }
            TransferHelper.safeApprove(token, spender, allowAmount);
        }
    }
    
    function addLiquidityETH(
        address user,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        uint256 deadline) external payable returns (
            uint256 _amountToken,
            uint256 _amountETH,
            uint256 _liquidity
        ) {
           require(msg.sender == owner, "Demax LP Forbidden");
           require(tokenA == WETH || tokenB == WETH, "INVALID CALL");
           address token = tokenA == WETH ? tokenB: tokenA;
           approveContract(token, PLATFORM, amountTokenDesired);
           TransferHelper.safeTransferFrom(token, msg.sender, address(this), amountTokenDesired);
           
           (_amountToken, _amountETH, _liquidity) = IDemaxPlatform(PLATFORM).addLiquidityETH{value: msg.value}(token, amountTokenDesired, amountTokenMin, amountETHMin, deadline);
           
           if(amountTokenDesired > _amountToken) {
                TransferHelper.safeTransfer(token, user, amountTokenDesired.sub(_amountToken));
            }
            
            if(msg.value > _amountETH) {
                TransferHelper.safeTransferETH(user, msg.value.sub(_amountETH));
            }
        _mintReward();
        _mint(user, _liquidity);
        _increaseProductivity(user, _liquidity);
        (uint amountA, uint amountB) = token == tokenA ? (_amountToken, _amountETH): (_amountETH, _amountToken);
        emit AddLiquidity (user, amountA, amountB, _liquidity);
    }
    
    function addLiquidity(
        address user,
        uint256 amountA,
        uint256 amountB,
        uint256 amountAMin,
        uint256 amountBMin,
        uint256 deadline) external returns (
            uint256 _amountA,
            uint256 _amountB,
            uint256 _liquidity
        ) {
            require(msg.sender == owner, "Demax LP Forbidden");
            approveContract(tokenA, PLATFORM, amountA);
            approveContract(tokenB, PLATFORM, amountB);
            TransferHelper.safeTransferFrom(tokenA, msg.sender, address(this), amountA);
            TransferHelper.safeTransferFrom(tokenB, msg.sender, address(this), amountB);
        (_amountA, _amountB, _liquidity) = IDemaxPlatform(PLATFORM).addLiquidity(tokenA, tokenB, amountA, amountB, amountAMin, amountBMin, deadline);
        if(amountA > _amountA) {
            TransferHelper.safeTransfer(tokenA, user, amountA.sub(_amountA));
        }
        
        if(amountB > _amountB) {
            TransferHelper.safeTransfer(tokenB, user, amountB.sub(_amountB));
        }
        
        _mintReward();
        _mint(user, _liquidity);
        _increaseProductivity(user, _liquidity);
        emit AddLiquidity (user, _amountA, _amountB, _liquidity);
    }
    
    function removeLiquidityETH (
        address user,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        uint256 deadline) external returns (uint256 _amountToken, uint256 _amountETH) {
         require(msg.sender == owner, "Demax LP Forbidden");
         require(tokenA == WETH || tokenB == WETH, "INVALID CALL");
         address token = tokenA == WETH ? tokenB: tokenA;
           
        (_amountToken, _amountETH) = IDemaxPlatform(PLATFORM).removeLiquidityETH(token, liquidity, amountTokenMin, amountETHMin, user, deadline);
         
        _mintReward();
        _burn(user, liquidity);
        _decreaseProductivity(user, liquidity);
        (uint amountA, uint amountB) = token == tokenA ? (_amountToken, _amountETH): (_amountETH, _amountToken);
        emit RemoveLiquidity (user, amountA, amountB, liquidity);
    }
    
    function removeLiquidity(
        address user,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        uint256 deadline) external returns (
            uint256 _amountA,
            uint256 _amountB
        ) {
            require(msg.sender == owner, "Demax LP Forbidden");
        (_amountA, _amountB) = IDemaxPlatform(PLATFORM).removeLiquidity(tokenA, tokenB, liquidity, amountAMin, amountBMin, user, deadline);
        
        _mintReward();
        _burn(user, liquidity);
        _decreaseProductivity(user, liquidity);
        emit RemoveLiquidity (user, _amountA, _amountB, liquidity);
    }
    
    function _currentReward() internal override view returns (uint) {
        address pair = IDemaxPlatform(PLATFORM).pairFor(tokenA, tokenB);
        uint countractAmount = mintedShare.add(IERC20(shareToken).balanceOf(address(this))).sub(totalShare);
        if(pair != address(0)) {
            uint poolAmount = IDemaxPool(POOL).queryReward(pair, address(this));
            (uint pairAmount, ) = IDemaxPair(pair).queryReward();
            return countractAmount.add(poolAmount).add(pairAmount);
        } else {
            return countractAmount;
        }
    }
    
    function _mintReward() internal {
        address pair = IDemaxPlatform(PLATFORM).pairFor(tokenA, tokenB);
        if(pair != address(0)) {
            uint poolAmount = IDemaxPool(POOL).queryReward(pair, address(this));
            (uint pairAmount, ) = IDemaxPair(pair).queryReward();
            if(poolAmount > 0) {
                IDemaxPool(POOL).claimReward(pair, shareToken);
            }
            
            if(pairAmount > 0) {
                IDemaxPair(pair).mintReward();
            }
        } 
    }
    
    function queryReward() external view returns (uint) {
        return _takeWithAddress(msg.sender);
    }
    
    function mintReward() external returns (uint amount) {
        _mintReward();
        amount = _mint(msg.sender);
        emit Mint(msg.sender, amount);
    }
}