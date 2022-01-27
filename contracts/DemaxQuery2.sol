// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >= 0.5.1;

struct Config {
        uint minValue;
        uint maxValue;
        uint maxSpan;
        uint value;
        uint enable;  // 0:disable, 1: enable
    }

interface IERC20 {
    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
    function allowance(address owner, address spender) external view returns (uint);

    function approve(address spender, uint value) external returns (bool);
    function transfer(address to, uint value) external returns (bool);
    function transferFrom(address from, address to, uint value) external returns (bool);
}

interface IDemaxConfig {
    function tokenCount() external view returns(uint);
    function tokenList(uint index) external view returns(address);
    function getConfigValue(bytes32 _name) external view returns (uint);
    function configs(bytes32 name) external view returns(Config memory);
    function tokenStatus(address token) external view returns(uint);
}

interface IDemaxPlatform {
    function existPair(address tokenA, address tokenB) external view returns (bool);
    function swapPrecondition(address token) external view returns (bool);
    function getReserves(address tokenA, address tokenB) external view returns (uint256, uint256);
}

interface IDemaxFactory {
    function getPair(address tokenA, address tokenB) external view returns(address);
}

interface IDemaxDelegate {
    function getPair(address tokenA, address tokenB) external view returns(address);
    function getPlayerPairCount(address player) external view returns(uint);
    function playerPairs(address user, uint index) external view returns(address);
    function countDelegateHistory() external view returns(uint);
    function delegateHistory(uint index) external view returns(address);
    function getDelegate(address _tokenA, address _tokenB) external view returns (address);
}

interface IDemaxLP {
    function tokenA() external view returns (address);
    function tokenB() external view returns (address);
}

interface IDemaxPair {
    function token0() external view returns(address);
    function token1() external view returns(address);
    function getReserves() external view returns(uint, uint, uint);
    function lastMintBlock(address user) external view returns(uint); 
}

interface IDemaxGovernance {
    function ballotCount() external view returns(uint);
    function rewardOf(address ballot) external view returns(uint);
    function tokenBallots(address ballot) external view returns(address);
    function ballotTypes(address ballot) external view returns(uint);
    function ballots(uint index) external view returns(address);
    function balanceOf(address owner) external view returns (uint);
    function ballotOf(address ballot) external view returns (uint);
    function allowance(address owner) external view returns (uint);
    function configBallots(address ballot) external view returns (bytes32);
    function stakingSupply() external view returns (uint);
    function collectUsers(address ballot, address user) external view returns(uint);
}

interface IDemaxBallot {
    struct Voter {
        uint weight; // weight is accumulated by delegation
        bool voted;  // if true, that person already voted
        address delegate; // person delegated to
        uint vote;   // index of the voted proposal
    }
    function subject() external view returns(string memory);
    function content() external view returns(string memory);
    function endBlockNumber() external view returns(uint);
    function createTime() external view returns(uint);
    function proposer() external view returns(address);
    function proposals(uint index) external view returns(uint);
    function ended() external view returns (bool);
    function value() external view returns (uint);
    function voters(address user) external view returns (Voter memory);
}

interface IDemaxTransferListener {
    function pairWeights(address pair) external view returns(uint);
}

pragma experimental ABIEncoderV2;

contract DemaxQuery2 {
    bytes32 public constant PRODUCE_DGAS_RATE = bytes32('PRODUCE_DGAS_RATE');
    bytes32 public constant SWAP_FEE_PERCENT = bytes32('SWAP_FEE_PERCENT');
    bytes32 public constant LIST_DGAS_AMOUNT = bytes32('LIST_DGAS_AMOUNT');
    bytes32 public constant UNSTAKE_DURATION = bytes32('UNSTAKE_DURATION');
    bytes32 public constant REMOVE_LIQUIDITY_DURATION = bytes32('REMOVE_LIQUIDITY_DURATION');
    bytes32 public constant TOKEN_TO_DGAS_PAIR_MIN_PERCENT = bytes32('TOKEN_TO_DGAS_PAIR_MIN_PERCENT');
    bytes32 public constant LIST_TOKEN_FAILURE_BURN_PRECENT = bytes32('LIST_TOKEN_FAILURE_BURN_PRECENT');
    bytes32 public constant LIST_TOKEN_SUCCESS_BURN_PRECENT = bytes32('LIST_TOKEN_SUCCESS_BURN_PRECENT');
    bytes32 public constant PROPOSAL_DGAS_AMOUNT = bytes32('PROPOSAL_DGAS_AMOUNT');
    bytes32 public constant VOTE_DURATION = bytes32('VOTE_DURATION');
    bytes32 public constant VOTE_REWARD_PERCENT = bytes32('VOTE_REWARD_PERCENT');
    bytes32 public constant PAIR_SWITCH = bytes32('PAIR_SWITCH');
    bytes32 public constant TOKEN_PENGDING_SWITCH = bytes32('TOKEN_PENGDING_SWITCH');
    bytes32 public constant TOKEN_PENGDING_TIME = bytes32('TOKEN_PENGDING_TIME');

    address public configAddr;
    address public platform;
    address public factory;
    address public owner;
    address public governance;
    address public transferListener;
    address public delegate;

    mapping(address => bool) disabledTokens;
    
    struct Proposal {
        address proposer;
        address ballotAddress;
        address tokenAddress;
        string subject;
        string content;
        uint createTime;
        uint endBlock;
        bool end;
        uint YES;
        uint NO;
        uint totalReward;
        uint ballotType;
        uint weight;
        bool minted;
        bool voted;
        uint voteIndex;
        bool audited;
        uint value;
        bytes32 key;
        uint currentValue;
    }
    
    struct Token {
        address tokenAddress;
        string symbol;
        uint decimal;
        uint balance;
        uint allowance;
        uint allowanceGov;
        uint status;
        uint totalSupply;
    }
    
    struct Liquidity {
        address pair;
        address lp;
        uint balance;
        uint totalSupply;
        uint lastBlock;
        address delegate;
    }

    struct LiquidityInfo {
        address pair;
        address lp;
        uint balance;
        uint totalSupply;
        uint lastBlock;
        uint currentBlock;
        address delegate;
        address token0;
        address token1;
        uint reserve0;
        uint reserve1;
    }
    
    constructor() public {
        owner = msg.sender;
    }
    
    function upgrade(address _config, address _platform, address _factory, address _governance, address _transferListener, address _delegate) public {
        require(owner == msg.sender, 'FORBIDDEN');
        configAddr = _config;
        platform = _platform;
        factory = _factory;
        governance = _governance;
        transferListener = _transferListener;
        delegate = _delegate;
    }

    function setDisabledToken(address _token, bool _value) public {
        require(owner == msg.sender, 'FORBIDDEN');
        disabledTokens[_token] = _value;
    }

    function setDisabledTokens(address[] memory _tokens, bool[] memory _values) public {
        require(_tokens.length == _values.length, "INVAID_PARAMTERS");
        require(owner == msg.sender, 'FORBIDDEN');
        for(uint i; i<_tokens.length; i++) {
            setDisabledToken(_tokens[i], _values[i]);
        }
    }

    function getToken(address _token) public view returns (Token memory tk) {
        tk.tokenAddress = _token;
        tk.status = IDemaxConfig(configAddr).tokenStatus(tk.tokenAddress);
        if(disabledTokens[tk.tokenAddress] == false) {
            tk.symbol = IERC20(tk.tokenAddress).symbol();
            tk.decimal = IERC20(tk.tokenAddress).decimals();
            tk.balance = IERC20(tk.tokenAddress).balanceOf(msg.sender);
            tk.allowance = IERC20(tk.tokenAddress).allowance(msg.sender, platform);
            tk.allowanceGov = IERC20(tk.tokenAddress).allowance(msg.sender, governance);
            tk.totalSupply = IERC20(tk.tokenAddress).totalSupply();
        }
    }

    function queryTokenList() public view returns (Token[] memory token_list) {
        uint count = IDemaxConfig(configAddr).tokenCount();
        if(count > 0) {
            token_list = new Token[](count);
            for(uint i = 0;i < count;i++) {
                token_list[i] =  getToken(IDemaxConfig(configAddr).tokenList(i));
            }
        }
    }

    function countTokenList() public view returns (uint) {
        return IDemaxConfig(configAddr).tokenCount();
    }

    function iterateTokenList(uint _start, uint _end) public view returns (Token[] memory token_list) {
        require(_start <= _end && _start >= 0 && _end >= 0, "INVAID_PARAMTERS");
        uint count = IDemaxConfig(configAddr).tokenCount();
        if(count > 0) {
            if (_end > count) _end = count;
            if (_start > _end) _start = _end;
            count = _end - _start;
            token_list = new Token[](count);
            uint index = 0;
            for(uint i = _start; i < _end; i++) {
                token_list[index] =  getToken(IDemaxConfig(configAddr).tokenList(i));
                index++;
            }
        }
    }

    function getLiquidity(address _delegate, uint _i) public view returns (Liquidity memory l) {
        address lp = IDemaxDelegate(_delegate).playerPairs(msg.sender, _i);
        return getLiquidity(_delegate, lp, msg.sender);
    }

    function getLiquidity(address _delegate, address _lp, address _user) public view returns (Liquidity memory l) {
        l.lp  = _lp;
        l.pair = IDemaxFactory(factory).getPair(IDemaxLP(l.lp).tokenA(), IDemaxLP(l.lp).tokenB());
        l.balance = IERC20(l.lp).balanceOf(_user);
        l.totalSupply = IERC20(l.pair).totalSupply();
        l.lastBlock = IDemaxPair(l.pair).lastMintBlock(_user);
        l.delegate = _delegate;
        return l;
    }

    function getLiquidityInfo(address _delegate, uint _i) public view returns (LiquidityInfo memory l) {
        address lp = IDemaxDelegate(_delegate).playerPairs(msg.sender, _i);
        return getLiquidityInfo(_delegate, lp, msg.sender);
    }

    function getLiquidityInfo(address _delegate, address _lp, address _user) public view returns (LiquidityInfo memory l) {
        l.lp  = _lp;
        l.token0 = IDemaxLP(l.lp).tokenA();
        l.token1 = IDemaxLP(l.lp).tokenB();
        l.pair = IDemaxFactory(factory).getPair(l.token0, l.token1);
        l.balance = IERC20(l.lp).balanceOf(_user);
        l.totalSupply = IERC20(l.pair).totalSupply();
        l.lastBlock = IDemaxPair(l.pair).lastMintBlock(_user);
        l.currentBlock = block.number;
        l.delegate = _delegate;

        (address token0, , , , uint reserve0, uint reserve1) = getPairReserve(l.pair);
        if(token0 == l.token0) {
            l.reserve0 = reserve0;
            l.reserve1 = reserve1;
        } else {
            l.reserve0 = reserve1;
            l.reserve1 = reserve0;
        }
        return l;
    }

    function getLiquidityInfoByTokens(address _delegate, address _tokenA, address _tokenB, address _user) public view returns (LiquidityInfo memory l) {
        address lp = IDemaxDelegate(_delegate).getPair(_tokenA, _tokenB);
        return getLiquidityInfo(_delegate, lp, _user);
    }
    
    function queryLiquidityListByDelegate(address _delegate) public view returns (Liquidity[] memory liquidity_list) {
        uint count = IDemaxDelegate(_delegate).getPlayerPairCount(msg.sender);
        if(count > 0) {
            liquidity_list = new Liquidity[](count);
            for(uint i = 0;i < count;i++) {
                liquidity_list[i] = getLiquidity(_delegate, i);
            }
        }
    }

    function countLiquidityListByDelegate(address _delegate) public view returns (uint) {
        return IDemaxDelegate(_delegate).getPlayerPairCount(msg.sender);
    }
        
    function iterateLiquidityListByDelegate(address _delegate, uint _start, uint _end) public view returns (Liquidity[] memory liquidity_list) {
        require(_start <= _end && _start >= 0 && _end >= 0, "INVAID_PARAMTERS");
        uint count = IDemaxDelegate(_delegate).getPlayerPairCount(msg.sender);
        if(count > 0) {
            if (_end > count) _end = count;
            if (_start > _end) _start = _end;
            count = _end - _start;
            liquidity_list = new Liquidity[](count);
            uint index = 0;
            for(uint i = _start;i < _end;i++) {
                liquidity_list[index] = getLiquidity(_delegate, i);
                index++;
            }
        }
    }

    function queryLiquidityInfoListByDelegate(address _delegate) public view returns (LiquidityInfo[] memory liquidity_list) {
        uint count = IDemaxDelegate(_delegate).getPlayerPairCount(msg.sender);
        if(count > 0) {
            liquidity_list = new LiquidityInfo[](count);
            for(uint i = 0;i < count;i++) {
                liquidity_list[i] = getLiquidityInfo(_delegate, i);
            }
        }
    }
    
    function iterateLiquidityInfoListByDelegate(address _delegate, uint _start, uint _end) public view returns (LiquidityInfo[] memory liquidity_list) {
        require(_start <= _end && _start >= 0 && _end >= 0, "INVAID_PARAMTERS");
        uint count = IDemaxDelegate(_delegate).getPlayerPairCount(msg.sender);
        if(count > 0) {
            if (_end > count) _end = count;
            if (_start > _end) _start = _end;
            count = _end - _start;
            liquidity_list = new LiquidityInfo[](count);
            uint index = 0;
            for(uint i = _start;i < _end;i++) {
                liquidity_list[index] = getLiquidityInfo(_delegate, i);
                index++;
            }
        }
    }
   
    function queryLiquidityList() public view returns (Liquidity[] memory liquidity_list) {
        uint count = IDemaxDelegate(delegate).getPlayerPairCount(msg.sender);
        uint countDelegate = IDemaxDelegate(delegate).countDelegateHistory();

        for(uint i; i<countDelegate; i++) {
            address _delegate = IDemaxDelegate(delegate).delegateHistory(i);
            count += IDemaxDelegate(_delegate).getPlayerPairCount(msg.sender);
        }

        liquidity_list = new Liquidity[](count);
        uint index;
        uint size = IDemaxDelegate(delegate).getPlayerPairCount(msg.sender);
        if(size > 0) {
            for(uint i = 0;i < size;i++) {
                liquidity_list[index] = getLiquidity(delegate, i);
                index++;
            }
        }
        for(uint i; i<countDelegate; i++) {
            address _delegate = IDemaxDelegate(delegate).delegateHistory(i);
            size = IDemaxDelegate(_delegate).getPlayerPairCount(msg.sender);
            if(size > 0) {
                for(uint j = 0;j < size;j++) {
                    liquidity_list[index] = getLiquidity(_delegate, j);
                    index++;
                }
            }
        }
        
        return liquidity_list;
    }


    function queryPairListInfo(address[] memory pair_list) public view returns (address[] memory token0_list, address[] memory token1_list, uint[] memory reserve0_list, uint[] memory reserve1_list) {
        uint count = pair_list.length;
        if(count > 0) {
            token0_list = new address[](count);
            token1_list = new address[](count);
            reserve0_list = new uint[](count);
            reserve1_list = new uint[](count);
            for(uint i = 0;i < count;i++) {
                token0_list[i] = IDemaxPair(pair_list[i]).token0();
                token1_list[i] = IDemaxPair(pair_list[i]).token1();
                (reserve0_list[i], reserve1_list[i], ) = IDemaxPair(pair_list[i]).getReserves();
            }
        }
    }
    
    function queryPairReserve(address[] memory token0_list, address[] memory token1_list) public
    view returns (uint[] memory reserve0_list, uint[] memory reserve1_list, bool[] memory exist_list) {
        uint count = token0_list.length;
        if(count > 0) {
            reserve0_list = new uint[](count);
            reserve1_list = new uint[](count);
            exist_list = new bool[](count);
            for(uint i = 0;i < count;i++) {
                if(IDemaxPlatform(platform).existPair(token0_list[i], token1_list[i])) {
                    (reserve0_list[i], reserve1_list[i]) = IDemaxPlatform(platform).getReserves(token0_list[i], token1_list[i]);
                    exist_list[i] = true;
                } else {
                    exist_list[i] = false;
                }
            }
        }
    }
    
    function queryConfig() public view returns (uint fee_percent, uint proposal_amount, uint unstake_duration, 
    uint remove_duration, uint list_token_amount, uint vote_percent){
        fee_percent = IDemaxConfig(configAddr).getConfigValue(SWAP_FEE_PERCENT);
        proposal_amount = IDemaxConfig(configAddr).getConfigValue(PROPOSAL_DGAS_AMOUNT);
        unstake_duration = IDemaxConfig(configAddr).getConfigValue(UNSTAKE_DURATION);
        remove_duration = IDemaxConfig(configAddr).getConfigValue(REMOVE_LIQUIDITY_DURATION);
        list_token_amount = IDemaxConfig(configAddr).getConfigValue(LIST_DGAS_AMOUNT);
        vote_percent = IDemaxConfig(configAddr).getConfigValue(VOTE_REWARD_PERCENT);
    }
    
    function queryCondition(address[] memory path_list) public view returns (uint){
        uint count = path_list.length;
        for(uint i = 0;i < count;i++) {
            if(!IDemaxPlatform(platform).swapPrecondition(path_list[i])) {
                return i + 1;
            }
        }
        
        return 0;
    }
    
    function generateProposal(address ballot_address) public view returns (Proposal memory proposal){
        proposal.proposer = IDemaxBallot(ballot_address).proposer();
        proposal.subject = IDemaxBallot(ballot_address).subject();
        proposal.content = IDemaxBallot(ballot_address).content();
        proposal.createTime = IDemaxBallot(ballot_address).createTime();
        proposal.endBlock = IDemaxBallot(ballot_address).endBlockNumber();
        proposal.end = block.number > IDemaxBallot(ballot_address).endBlockNumber() ? true: false;
        proposal.audited = IDemaxBallot(ballot_address).ended();
        proposal.YES = IDemaxBallot(ballot_address).proposals(1);
        proposal.NO = IDemaxBallot(ballot_address).proposals(2);
        proposal.totalReward = IDemaxGovernance(governance).ballotOf(ballot_address);
        proposal.ballotAddress = ballot_address;
        proposal.voted = IDemaxBallot(ballot_address).voters(msg.sender).voted;
        proposal.voteIndex = IDemaxBallot(ballot_address).voters(msg.sender).vote;
        proposal.weight = IDemaxBallot(ballot_address).voters(msg.sender).weight;
        proposal.minted = IDemaxGovernance(governance).collectUsers(ballot_address, msg.sender) == 1;
        proposal.ballotType = IDemaxGovernance(governance).ballotTypes(ballot_address);
        proposal.tokenAddress = IDemaxGovernance(governance).tokenBallots(ballot_address);
        proposal.value = IDemaxBallot(ballot_address).value();
        if(proposal.ballotType == 1) {
            proposal.key = IDemaxGovernance(governance).configBallots(ballot_address);
            proposal.currentValue = IDemaxConfig(governance).getConfigValue(proposal.key);
        }
    }
    
    function queryTokenItemInfoWithSpender(address token, address spender) public view returns (string memory symbol, uint decimal, uint totalSupply, uint balance, uint allowance) {
        symbol = IERC20(token).symbol();
        decimal = IERC20(token).decimals();
        totalSupply = IERC20(token).totalSupply();
        balance = IERC20(token).balanceOf(msg.sender);
        allowance = IERC20(token).allowance(msg.sender, spender);
    }
  
    function queryTokenItemInfo(address token) public view returns (string memory symbol, uint decimal, uint totalSupply, uint balance, uint allowance) {
        (symbol, decimal, totalSupply, balance, allowance) = queryTokenItemInfoWithSpender(token, delegate);
    }
    
    function queryConfigInfo(bytes32 name) public view returns (Config memory config_item){
        config_item = IDemaxConfig(configAddr).configs(name);
    }
    
    function queryStakeInfo() public view returns (uint stake_amount, uint stake_block, uint total_stake) {
        stake_amount = IDemaxGovernance(governance).balanceOf(msg.sender);
        stake_block = IDemaxGovernance(governance).allowance(msg.sender);
        total_stake = IDemaxGovernance(governance).stakingSupply();
    }

    function queryProposalList() public view returns (Proposal[] memory proposal_list){
        uint count = IDemaxGovernance(governance).ballotCount();
        proposal_list = new Proposal[](count);
        for(uint i = 0;i < count;i++) {
            address ballot_address = IDemaxGovernance(governance).ballots(i);
            proposal_list[count - i - 1] = generateProposal(ballot_address);
        }
    }

    function countProposalList() public view returns (uint) {
        return IDemaxGovernance(governance).ballotCount();
    }

    function iterateProposalList(uint _start, uint _end) public view returns (Proposal[] memory proposal_list){
        require(_start <= _end && _start >= 0 && _end >= 0, "INVAID_PARAMTERS");
        uint count = IDemaxGovernance(governance).ballotCount();
        if (_end > count) _end = count;
        if (_start > _end) _start = _end;
        count = _end - _start;
        proposal_list = new Proposal[](count);
        uint index = 0;
        for(uint i = _start;i < _end;i++) {
            address ballot_address = IDemaxGovernance(governance).ballots(i);
            proposal_list[index] = generateProposal(ballot_address);
            index++;
        }
    }

    function iterateReverseProposalList(uint _start, uint _end) public view returns (Proposal[] memory proposal_list){
        require(_end <= _start && _end >= 0 && _start >= 0, "INVAID_PARAMTERS");
        uint count = IDemaxGovernance(governance).ballotCount();
        if (_start > count) _start = count;
        if (_end > _start) _end = _start;
        count = _start - _end;
        proposal_list = new Proposal[](count);
        uint index = 0;
        for(uint i = _end;i < _start; i++) {
            uint j = _start - index -1;
            address ballot_address = IDemaxGovernance(governance).ballots(j);
            proposal_list[index] = generateProposal(ballot_address);
            index++;
        }
        return proposal_list;
    }
        
    function queryPairWeights(address[] memory pairs) public view returns (uint[] memory weights){
        uint count = pairs.length;
        weights = new uint[](count);
        for(uint i = 0; i < count; i++) {
            weights[i] = IDemaxTransferListener(transferListener).pairWeights(pairs[i]);
        }
    }

    function getPairReserveByTokens(address _tokenA, address _tokenB) public view returns (address token0, address token1, uint8 decimals0, uint8 decimals1, uint reserve0, uint reserve1) {
        address pair = IDemaxFactory(factory).getPair(_tokenA, _tokenB);
        return getPairReserve(pair);
    }

    function getPairReserve(address _pair) public view returns (address token0, address token1, uint8 decimals0, uint8 decimals1, uint reserve0, uint reserve1) {
        token0 = IDemaxPair(_pair).token0();
        token1 = IDemaxPair(_pair).token1();
        decimals0 = IERC20(token0).decimals();
        decimals1 = IERC20(token1).decimals();
        (reserve0, reserve1, ) = IDemaxPair(_pair).getReserves();
    }

    function getPairReserveWithUser(address _pair, address _user) public view returns (address token0, address token1, uint8 decimals0, uint8 decimals1, uint reserve0, uint reserve1, uint balance0, uint balance1) {
        token0 = IDemaxPair(_pair).token0();
        token1 = IDemaxPair(_pair).token1();
        decimals0 = IERC20(token0).decimals();
        decimals1 = IERC20(token1).decimals();
        (reserve0, reserve1, ) = IDemaxPair(_pair).getReserves();
        balance0 = IERC20(token0).balanceOf(_user);
        balance1 = IERC20(token1).balanceOf(_user);
    }
}