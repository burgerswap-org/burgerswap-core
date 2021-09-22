pragma solidity >=0.6.6;
pragma experimental ABIEncoderV2;
import './modules/ProjectConfigable.sol';

interface ISwapPair {
    function totalSupply() external view returns(uint);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

interface IDemaxLP {
    function totalSupply() external view returns(uint);
    function tokenA() external view returns (address);
    function tokenB() external view returns (address);
}

interface IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint);
    function totalSupply() external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
    function allowance(address owner, address spender) external view returns (uint);
}

interface ISwapFactory {
    function getPair(address _token0, address _token1) external view returns (address);
    function allPairs(uint _index) external view returns (address);
    function allPairsLength() external view returns (uint);
}

interface IDemaxProjectDeploy {
    function getFactoryList() external view returns (address[] memory);
    function getPoolList(address _factory) external view returns (address[] memory);
    function factoryList(address _mintToken) external view returns (address);
    function poolList(address _factory, address _lpToken) external view returns (address);
    function getPoolByIndex(address _factory, uint _index) external view returns (address);
    function factories(uint _index) external view returns (address);
    function factoryListLength() external view returns (uint);
    function factoryPoolListLength(address _factory) external view returns (uint);
    function disabledFactory(address _factory) external view returns (bool);
    function disabledPool(address _pool) external view returns (bool);
}

struct MintStruct {
    uint weight;
    uint amountToMint;
    uint aPerBMinted;
}

interface IDemaxProjectFactory {
    function mintToken() external view returns (address);
    function owner() external view returns (address);
    function mintRate() external view returns (uint);
    function mintTotal() external view returns (uint);
    function amountPerWeight() external view returns (uint);
    function startBlock() external view returns (uint);
    function finishBlock() external view returns (uint);
    function totalWeight() external view returns (uint);
    function pools(address _pool) external view returns (MintStruct memory);
    function intro() external view returns (string memory);
}

interface IDemaxProjectPool {
    function factory() external view returns (address);
    function mintToken() external view returns (address);
    function burgerToken() external view returns (address);
    function lpToken() external view returns (address);
    function totalStake() external view returns (uint);
    function balance(address _user) external view returns (uint);
    function queryBurger(address _user) external view returns(uint);
    function queryReward(address _user) external view returns(uint);
}

contract DemaxProjectQuery is ProjectConfigable {
    string public chainSymbol = 'ETH';
    address public baseToken;
    address public projectDeploy;
    address public demaxFactory;
    address[] public routerTokens;
    mapping(address=>uint) public tokenType; //0 demax LP, 1 uni LP, 2 token
    mapping(address=>uint) public factoryOrder;
    mapping(address=>mapping(address=>uint)) public poolOrder;

    struct FactoryData {
        address factory;
        address owner;
        address mintToken;
        uint mintRate;
        uint mintTotal;
        uint totalWeight;
        uint amountPerWeight;
        uint startBlock;
        uint finishBlock;
        bool disabled;
        uint order;
        uint mintTokenDecimals;
        string mintTokenSymbol;
        string intro;
    }

    struct PoolData {
        address pool;
        address factory;
        address lpToken;
        address burgerToken;
        address mintToken;
        uint totalStake;
        uint totalStakeValue;
        uint mintTokenBalance;
        uint userBurger;
        uint userReward;
        uint userBalance;
        uint userAllowance;
        address lpToken0;
        address lpToken1;
        uint burgerTokenDecimals;
        uint mintTokenDecimals;
        uint weight;
        bool disabled;
        uint order;
        string burgerTokenSymbol;
        string mintTokenSymbol;
        string lpToken0Symbol;
        string lpToken1Symbol;
    }

    constructor() public {
        uint id;
        assembly {
            id := chainid()
        }
        if(id == 56 || id == 97) {
            chainSymbol = 'BNB';
        } else if(id == 128 || id == 256) {
            chainSymbol = 'HT';
        }
    }

    function initialize(address _projectDeploy, address _baseToken, address _demaxFactory) public onlyOwner {
        projectDeploy = _projectDeploy;
        baseToken = _baseToken;
        demaxFactory = _demaxFactory;
    }
       
    function addRouterTokens(address[] memory tokens) public onlyOwner {
        for(uint i; i< tokens.length; i++) {
            addRouterToken(tokens[i]);
        }
    }

    function addRouterToken(address token) public onlyOwner {
        if(isRouterToken(token) == false) {
            routerTokens.push(token);
        }
    }

    function removeRouterTokens(address[] memory tokens) public onlyOwner {
        for(uint i; i< tokens.length; i++) {
            removeRouterToken(tokens[i]);
        }
    }

    function removeRouterToken(address token) public onlyOwner {
        uint index = indexRouterToken(token);
        if(index == routerTokens.length) {
            return;
        }
        if(index < routerTokens.length -1) {
            routerTokens[index] = routerTokens[routerTokens.length-1];
        }
        routerTokens.pop();
    }

    function isRouterToken(address token) public view returns (bool) {
        for(uint i = 0;i < routerTokens.length;i++) {
            if(token == routerTokens[i]) {
                return true;
            }
        }
        return false;
    }
    
    function indexRouterToken(address token) public view returns (uint) {
        for(uint i; i< routerTokens.length; i++) {
            if(routerTokens[i] == token) {
                return i;
            }
        }
        return routerTokens.length;
    }

    function countRouterToken() public view returns (uint) {
        return routerTokens.length;
    }


    function setToken(address _token, uint _value) onlyDev public {
        tokenType[_token] = _value;
    }

    function batchSetToken(address[] calldata _tokens, uint[] calldata _values) onlyDev external {
        require(_tokens.length == _values.length, 'invalid parma');
        for(uint i; i < _tokens.length; i++) {
            setToken(_tokens[i], _values[i]);
        }
    }

    function setFactoryOrder(address _factory, uint _order) public onlyDev {
        factoryOrder[_factory] = _order;
    }

    function batchSetFactoryOrder(address[] calldata  _factory, uint[] calldata _order) external onlyDev {
        require(_factory.length == _order.length, 'invalid parma');
        for(uint i; i < _factory.length; i++) {
            setFactoryOrder(_factory[i], _order[i]);
        }
    }

    function setPoolOrder(address _factory, address _pool, uint _order) public onlyDev {
        poolOrder[_factory][_pool] = _order;
    }

    function batchSetPoolOrder(address[] calldata  _factory, address[] calldata _pool, uint[] calldata _order) external onlyDev {
        require(_factory.length == _order.length && _pool.length == _order.length, 'invalid parma');
        for(uint i; i < _factory.length; i++) {
            setPoolOrder(_factory[i], _pool[i], _order[i]);
        }
    }

    function getFactoryData(address _factory) public view returns (FactoryData memory data) {
        data.factory = _factory; 
        data.owner = IDemaxProjectFactory(_factory).owner(); 
        data.mintToken = IDemaxProjectFactory(_factory).mintToken();
        data.mintRate = IDemaxProjectFactory(_factory).mintRate(); 
        data.mintTotal = IDemaxProjectFactory(_factory).mintTotal();
        data.totalWeight = IDemaxProjectFactory(_factory).totalWeight(); 
        data.amountPerWeight = IDemaxProjectFactory(_factory).amountPerWeight();
        data.startBlock = IDemaxProjectFactory(_factory).startBlock();
        data.finishBlock = IDemaxProjectFactory(_factory).finishBlock(); 
        data.disabled = IDemaxProjectDeploy(projectDeploy).disabledFactory(_factory);
        data.order = factoryOrder[_factory];
        if(data.disabled){
            return data;
        }
        data.mintTokenDecimals = IERC20(data.mintToken).decimals();
        data.mintTokenSymbol = IERC20(data.mintToken).symbol();
        data.intro = IDemaxProjectFactory(_factory).intro();
        return data;
    }

    function getFactoryDataByIndex(uint _index) public view returns (FactoryData memory data) {
        return getFactoryData(IDemaxProjectDeploy(projectDeploy).factories(_index));
    }

    function getFactoryList() external view returns (FactoryData[] memory list) {
        address[] memory data = IDemaxProjectDeploy(projectDeploy).getFactoryList();
        uint count = data.length;
        list = new FactoryData[](count);
        if (count == 0) return list;
        for(uint i;i < count; i++) {
            list[i] = getFactoryData(data[i]);
        }
        return list;
    }

    function iterateReverseFactoryList(uint _start, uint _end) public view returns (FactoryData[] memory list){
        require(_end <= _start && _end >= 0 && _start >= 0, "INVAID_PARAMTERS");
        uint count = IDemaxProjectDeploy(projectDeploy).factoryListLength();
        if (_start > count) _start = count;
        if (_end > _start) _end = _start;
        count = _start - _end; 
        list = new FactoryData[](count);
        if (count == 0) return list;
        uint index = 0;
        for(uint i = _end;i < _start; i++) {
            uint j = _start - index -1;
            list[index] = getFactoryDataByIndex(j);
            index++;
        }
        return list;
    }

    function getPoolData(address _pool) public view returns (PoolData memory data) {
        data.pool = _pool; 
        data.factory = IDemaxProjectPool(_pool).factory(); 
        data.lpToken = IDemaxProjectPool(_pool).lpToken(); 
        data.burgerToken = IDemaxProjectPool(_pool).burgerToken(); 
        data.mintToken = IDemaxProjectPool(_pool).mintToken();
        data.totalStake = IDemaxProjectPool(_pool).totalStake(); 
        data.disabled = IDemaxProjectDeploy(projectDeploy).disabledPool(_pool);
        data.order = poolOrder[data.factory][_pool];
        if(data.disabled){
            return data;
        }
        data.mintTokenBalance = IERC20(data.mintToken).balanceOf(_pool); 
        data.userBurger = IDemaxProjectPool(_pool).queryBurger(msg.sender); 
        data.userReward = IDemaxProjectPool(_pool).queryReward(msg.sender); 
        data.userBalance = IDemaxProjectPool(_pool).balance(msg.sender); 
        data.userAllowance = IERC20(data.lpToken).allowance(msg.sender, _pool);
        data.burgerTokenDecimals = IERC20(data.burgerToken).decimals();
        data.mintTokenDecimals = IERC20(data.mintToken).decimals();
        data.burgerTokenSymbol = IERC20(data.burgerToken).symbol();
        data.mintTokenSymbol = IERC20(data.mintToken).symbol();
        
        if (tokenType[data.lpToken] == 0) {
            data.lpToken0 = IDemaxLP(data.lpToken).tokenA();
            data.lpToken1 = IDemaxLP(data.lpToken).tokenB();
            data.lpToken0Symbol = IERC20(data.lpToken0).symbol();
            data.lpToken1Symbol = IERC20(data.lpToken1).symbol();
            data.totalStakeValue = getLpBaseTokenValue(data.lpToken0, data.lpToken1, data.totalStake);
        } else if(tokenType[data.lpToken] == 1) {
            data.lpToken0 = ISwapPair(data.lpToken).token0();
            data.lpToken1 = ISwapPair(data.lpToken).token1();
            data.lpToken0Symbol = IERC20(data.lpToken0).symbol();
            data.lpToken1Symbol = IERC20(data.lpToken1).symbol();
            data.totalStakeValue = getLpBaseTokenValue(data.lpToken0, data.lpToken1, data.totalStake);
        } else if(tokenType[data.lpToken] == 2) {
            data.lpToken0Symbol = IERC20(data.lpToken).symbol();
            data.totalStakeValue = getCurrentRate(data.lpToken, data.totalStake);
        } else {
            data.lpToken0Symbol = chainSymbol;
        }
        MintStruct memory ms = IDemaxProjectFactory(data.factory).pools(_pool);
        data.weight = ms.weight;
        return data;
    }

    function getPoolList(address _factory) external view returns (PoolData[] memory list) {
        address[] memory pools = IDemaxProjectDeploy(projectDeploy).getPoolList(_factory);
        uint count = pools.length;
        list = new PoolData[](count);
        if (count == 0) return list;
        for(uint i;i < count; i++) {
            list[i] = getPoolData(pools[i]);
        }
        return list;
    }

    function getPair(address _factory, address _token0, address _token1) public view returns (address) {
        return ISwapFactory(_factory).getPair(_token0, _token1);
    }

    function getCurrentRate(address _tokenIn, uint _amount) public view returns (uint) {
        if(_tokenIn == baseToken) {
            return _amount;
        }
        address pair = getPair(demaxFactory, _tokenIn, baseToken);
        if(pair == address(0)) {
            return 0;
        }
        (uint112 reserve0, uint112 reserve1, ) = ISwapPair(pair).getReserves();
        if(reserve0 == 0 || reserve1 ==0) {
            return 0;
        }
        uint tokenInReserve = uint(reserve0);
        uint tokenOutReserve = uint(reserve1);
        uint tokenInDecimals = uint(IERC20(_tokenIn).decimals());
        uint tokenOutDecimals = uint(IERC20(baseToken).decimals());
        if(ISwapPair(pair).token0() != _tokenIn) {
            tokenInDecimals = IERC20(baseToken).decimals();
            tokenOutDecimals = IERC20(_tokenIn).decimals();
            tokenInReserve = uint(reserve1);
            tokenOutReserve = uint(reserve0);
        }
        if(tokenInDecimals > tokenOutDecimals) {
            tokenOutReserve = tokenOutReserve * 10** (tokenInDecimals - tokenOutDecimals);
        } else if(tokenInDecimals < tokenOutDecimals) {
            tokenInReserve = tokenInReserve * 10** (tokenOutDecimals - tokenInDecimals);
        }

        return _amount * tokenOutReserve / tokenInReserve;
    }

    function getSwapPairReserve(address _pair) public view returns (address token0, address token1, uint decimals0, uint decimals1, uint reserve0, uint reserve1, uint totalSupply) {
        totalSupply = ISwapPair(_pair).totalSupply();
        token0 = ISwapPair(_pair).token0();
        token1 = ISwapPair(_pair).token1();
        decimals0 = IERC20(token0).decimals();
        decimals1 = IERC20(token1).decimals();
        (reserve0, reserve1, ) = ISwapPair(_pair).getReserves();
    }

    // _tokenB is base token
    function getLpValueByFactory(address _tokenA, address _tokenB, uint _amount) public view returns (uint, uint) {
        address pair = ISwapFactory(demaxFactory).getPair(_tokenA, _tokenB);
        (, address token1, uint decimals0, uint decimals1, uint reserve0, uint reserve1, uint totalSupply) = getSwapPairReserve(pair);
        if(_amount == 0 || totalSupply == 0) {
            return (0, 0);
        }
        uint decimals = decimals0;
        uint total = reserve0 * 2;
        if(_tokenB == token1) {
            total = reserve1 * 2;
            decimals = decimals1;
        }
        return (_amount*total/totalSupply, decimals);
    }

    function getLpBaseTokenValue(address _tokenA, address _tokenB, uint _amount) public view returns (uint) {
        address _inToken = _tokenA;
        address _baseToken = _tokenB;
        if(_tokenB == baseToken) {
            // default
        } else if(_tokenA == baseToken || isRouterToken(_tokenA)) {
            _inToken = _tokenB;
            _baseToken = _tokenA;
        } 
        (uint amount, ) = getLpValueByFactory(_inToken, _baseToken, _amount);
        
        return getCurrentRate(_baseToken, amount);
    }
}