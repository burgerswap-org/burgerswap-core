pragma solidity >=0.6.6;

import './libraries/Math.sol';
import './libraries/UQ112x112.sol';
import './interfaces/IDemaxFactory.sol';
import './interfaces/IDgas.sol';
import './interfaces/IDemaxCallee.sol';
import './interfaces/IDemaxConfig.sol';
import './modules/BaseShareField.sol';
import './libraries/ConfigNames.sol';

contract DemaxPair is BaseShareField {
    uint256 public version = 1;
    using SafeMath for uint256;
    using UQ112x112 for uint224;

    uint256 public constant MINIMUM_LIQUIDITY = 10**3;
    bytes4 private constant SELECTOR = bytes4(keccak256(bytes('transfer(address,uint256)')));

    address public FACTORY;
    address public CONFIG;
    address public DGAS;
    address public token0;
    address public token1;

    uint112 private reserve0; // uses single storage slot, accessible via getReserves
    uint112 private reserve1; // uses single storage slot, accessible via getReserves
    uint32 private blockTimestampLast; // uses single storage slot, accessible via getReserves

    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;

    uint256 public totalReward;
    uint256 public remainReward;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    event Mint(address indexed from, address indexed to, uint256 value);
    event Burn(address indexed from, address indexed to, uint256 value);
    event MintDGAS(address indexed player, uint256 pairMint, uint256 userMint);
    mapping(address => uint256) public lastMintBlock;

    uint private unlocked = 1;
    modifier lock() {
        require(unlocked == 1, 'Locked');
        unlocked = 0;
        _;
        unlocked = 1;
    }

    function _mint(address to, uint256 value) internal {
        totalSupply = totalSupply.add(value);
        balanceOf[to] = balanceOf[to].add(value);
        emit Mint(address(0), to, value);
    }

    function _burn(address from, uint256 value) internal {
        balanceOf[from] = balanceOf[from].sub(value);
        totalSupply = totalSupply.sub(value);
        emit Burn(from, address(0), value);
    }
    
    function _mintDGAS() internal {
        if(IDgas(DGAS).take() > 0) {
            uint reward = IDgas(DGAS).mint();
            uint devAmount = reward * IDemaxConfig(CONFIG).getConfigValue(ConfigNames.DEV_PRECENT) / 10000;
            address devAddress = IDemaxConfig(CONFIG).dev();
            _safeTransfer(DGAS, devAddress, devAmount);
            remainReward = remainReward.add(reward.sub(devAmount));
        }
    }
    
    function _currentReward() internal override view returns (uint) {
        uint devPercent = IDemaxConfig(CONFIG).getConfigValue(ConfigNames.DEV_PRECENT);
        uint pairReward = IDgas(DGAS).take().mul(10000 - devPercent).div(10000);
        return mintedShare.add(remainReward).add(pairReward).sub(totalShare);
    }

    function getReserves()
        public
        view
        returns (
            uint112 _reserve0,
            uint112 _reserve1,
            uint32 _blockTimestampLast
        )
    {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    function _safeTransfer(
        address token,
        address to,
        uint256 value
    ) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(SELECTOR, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'DEMAX PAIR : TRANSFER_FAILED');
    }

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event SwapFee(address indexed token, address indexed to, uint256 amount);
    event Sync(uint112 reserve0, uint112 reserve1);

    constructor() public {
        FACTORY = msg.sender;
    }

    modifier onlyPlatform {
        address platform = IDemaxConfig(CONFIG).platform();
        require(msg.sender == platform, 'DEMAX PAIR : FORBIDDEN');
        _;
    }

    // called once by the factory at time of deployment
    function initialize(
        address _token0,
        address _token1,
        address _config,
        address _dgas
    ) external {
        require(msg.sender == FACTORY, 'DEMAX PAIR : FORBIDDEN');
        token0 = _token0;
        token1 = _token1;
        CONFIG = _config;
        DGAS = _dgas;
        _setShareToken(DGAS);
    }

    // update reserves and, on the first call per block, price accumulators
    function _update(
        uint256 balance0,
        uint256 balance1,
        uint112 _reserve0,
        uint112 _reserve1
    ) private {
        require(balance0 <= uint112(-1) && balance1 <= uint112(-1), 'DEMAX PAIR : OVERFLOW');
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast; // overflow is desired
        if (timeElapsed > 0 && _reserve0 != 0 && _reserve1 != 0) {
            // * never overflows, and + overflow is desired
            price0CumulativeLast += uint256(UQ112x112.encode(_reserve1).uqdiv(_reserve0)) * timeElapsed;
            price1CumulativeLast += uint256(UQ112x112.encode(_reserve0).uqdiv(_reserve1)) * timeElapsed;
        }
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = blockTimestamp;
        emit Sync(reserve0, reserve1);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function mint(address to) external onlyPlatform lock returns (uint256 liquidity) {
        (uint112 _reserve0, uint112 _reserve1, ) = getReserves(); // gas savings
        uint256 balance0 = _balanceOf(token0, address(this));
        uint256 balance1 = _balanceOf(token1, address(this));
        uint256 amount0 = balance0.sub(_reserve0);
        uint256 amount1 = balance1.sub(_reserve1);
        uint256 _totalSupply = totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee
        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amount0.mul(amount1)).sub(MINIMUM_LIQUIDITY);
            _mint(address(0), MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens
        } else {
            liquidity = Math.min(amount0.mul(_totalSupply) / _reserve0, amount1.mul(_totalSupply) / _reserve1);
        }
        require(liquidity > 0, 'DEMAX PAIR : INSUFFICIENT_LIQUIDITY_MINTED');
        _mint(to, liquidity);
        _mintDGAS();
        _increaseProductivity(to, liquidity);
        lastMintBlock[to] = block.number;
        _update(balance0, balance1, _reserve0, _reserve1);
        emit Mint(msg.sender, amount0, amount1);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function burn(
        address from,
        address to,
        uint256 amount
    ) external onlyPlatform lock returns (uint256 amount0, uint256 amount1) {
        require(
            block.number >=
                lastMintBlock[from] + IDemaxConfig(CONFIG).getConfigValue(ConfigNames.REMOVE_LIQUIDITY_DURATION),
            'DEMAX PLATFORM : REMOVE LIQUIDITY DURATION FAIL'
        );
        (uint112 _reserve0, uint112 _reserve1, ) = getReserves(); // gas savings
        address _token0 = token0; // gas savings
        address _token1 = token1; // gas savings
        uint256 balance0 = _balanceOf(_token0, address(this));
        uint256 balance1 = _balanceOf(_token1, address(this));
        require(balanceOf[from] >= amount, 'DEMAX PAIR : INSUFFICIENT_LIQUIDITY_AMOUNT');

        uint256 _totalSupply = totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee
        amount0 = amount.mul(balance0) / _totalSupply; // using balances ensures pro-rata distribution
        amount1 = amount.mul(balance1) / _totalSupply; // using balances ensures pro-rata distribution
        require(amount0 > 0 && amount1 > 0, 'DEMAX PAIR : INSUFFICIENT_LIQUIDITY_BURNED');
        _burn(from, amount);
        _mintDGAS();
        _decreaseProductivity(from, amount);

        _safeTransfer(_token0, to, amount0);
        _safeTransfer(_token1, to, amount1);
        balance0 = _balanceOf(_token0, address(this));
        balance1 = _balanceOf(_token1, address(this));
        _update(balance0, balance1, _reserve0, _reserve1);

        emit Burn(msg.sender, amount0, amount1, to);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata data
    ) external onlyPlatform lock {
        require(amount0Out > 0 || amount1Out > 0, 'DEMAX PAIR : INSUFFICIENT_OUTPUT_AMOUNT');
        (uint112 _reserve0, uint112 _reserve1, ) = getReserves(); // gas savings
        require(amount0Out < _reserve0 && amount1Out < _reserve1, 'DEMAX PAIR :  INSUFFICIENT_LIQUIDITY');
        uint256 balance0;
        uint256 balance1;
        {
            address _token0 = token0;
            address _token1 = token1;
            require(to != _token0 && to != _token1, 'DEMAX PAIR : INVALID_TO');
            if (amount0Out > 0) _safeTransfer(_token0, to, amount0Out);
            if (amount1Out > 0) _safeTransfer(_token1, to, amount1Out);
            if (data.length > 0) IDemaxCallee(to).demaxCall(msg.sender, amount0Out, amount1Out, data);
            balance0 = _balanceOf(_token0, address(this));
            balance1 = _balanceOf(_token1, address(this));
        }
        uint256 amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint256 amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        uint256 _amount0Out = amount0Out;
        uint256 _amount1Out = amount1Out;
        require(amount0In > 0 || amount1In > 0, 'DEMAX PAIR : INSUFFICIENT_INPUT_AMOUNT');
        _update(balance0, balance1, _reserve0, _reserve1);
        emit Swap(msg.sender, amount0In, amount1In, _amount0Out, _amount1Out, to);
    }

    function swapFee(
        uint256 amount,
        address token,
        address to
    ) external onlyPlatform {
        if (amount == 0 || token == to) return;
        (uint112 _reserve0, uint112 _reserve1, ) = getReserves();
        require(to != token0 && to != token1, 'DEMAX PAIR : INVALID_TO');
        _safeTransfer(token, to, amount);
        uint256 balance0 = _balanceOf(token0, address(this));
        uint256 balance1 = _balanceOf(token1, address(this));
        _update(balance0, balance1, _reserve0, _reserve1);
        emit SwapFee(token, to , amount);
    }

    function queryReward() external view returns (uint256 rewardAmount, uint256 blockNumber) {
        rewardAmount = _takeWithAddress(msg.sender);
        blockNumber = block.number;
    }

    function mintReward() external lock returns (uint256 userReward) {
        _mintDGAS();
        userReward = _mint(msg.sender);
        remainReward = remainReward.sub(userReward);
        emit MintDGAS(msg.sender, remainReward, userReward);
    }

    function skim(address to) external lock {
        address _token0 = token0;
        address _token1 = token1;
        _safeTransfer(_token0, to, _balanceOf(_token0, address(this)).sub(reserve0));
        _safeTransfer(_token1, to, _balanceOf(_token0, address(this)).sub(reserve1));
    }

    function getDGASReserve() public view returns (uint256) {
        return _balanceOf(DGAS, address(this));
    }

    function _balanceOf(address token, address owner) internal view returns (uint256) {
        if (token == DGAS && owner == address(this)) {
            return IERC20(token).balanceOf(owner).sub(remainReward);
        } else {
            return IERC20(token).balanceOf(owner);
        }
    }

    // force reserves to match balances
    function sync() external lock {
        _update(_balanceOf(token0, address(this)), _balanceOf(token1, address(this)), reserve0, reserve1);
    }
}
