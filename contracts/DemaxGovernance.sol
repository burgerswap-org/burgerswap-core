pragma solidity >=0.6.6;

import './interfaces/IDemaxConfig.sol';
import './interfaces/IDemaxBallotFactory.sol';
import './interfaces/IDemaxBallot.sol';
import './interfaces/IDgas.sol';
import './interfaces/ITokenRegistry.sol';
import './libraries/ConfigNames.sol';
import './libraries/TransferHelper.sol';
import './modules/DgasStaking.sol';
import './modules/Ownable.sol';

contract DemaxGovernance is DgasStaking, Ownable {
    uint public version = 1;
    address public configAddr;
    address public ballotFactoryAddr;
    address public rewardAddr;

    uint public T_CONFIG = 1;
    uint public T_LIST_TOKEN = 2;
    uint public T_TOKEN = 3;
    mapping(address => uint) public ballotTypes;
    mapping(address => bytes32) public configBallots;
    mapping(address => address) public tokenBallots;
    mapping(address => uint) public rewardOf;
    mapping(address => uint) public ballotOf;
    mapping(address => mapping(address => uint)) public applyTokenOf;
    mapping(address => mapping(address => bool)) public collectUsers;
    mapping(address => address) public tokenUsers;

    address[] public ballots;

    event ConfigAudited(bytes32 name, address indexed ballot, uint proposal);
    event ConfigBallotCreated(address indexed proposer, bytes32 name, uint value, address indexed ballotAddr, uint reward);
    event TokenBallotCreated(address indexed proposer, address indexed token, uint value, address indexed ballotAddr, uint reward);
    event ProposalerRewardRateUpdated(uint oldVaue, uint newValue);
    event RewardTransfered(address indexed from, address indexed to, uint value);
    event TokenListed(address user, address token, uint amount);
    event ListTokenAudited(address user, address token, uint status, uint burn, uint reward, uint refund);
    event TokenAudited(address user, address token, uint status, bool result);
    event RewardCollected(address indexed user, address indexed ballot, uint value);
    event RewardReceived(address indexed user, uint value);

    modifier onlyRewarder() {
        require(msg.sender == rewardAddr, 'DemaxGovernance: ONLY_REWARDER');
        _;
    }

    constructor (address _dgas) DgasStaking(_dgas) public {
    }

    // called after deployment
    function initialize(address _rewardAddr, address _configContractAddr, address _ballotFactoryAddr) external onlyOwner {
        require(_rewardAddr != address(0) && _configContractAddr != address(0) && _ballotFactoryAddr != address(0), 'DemaxGovernance: INPUT_ADDRESS_IS_ZERO');

        rewardAddr = _rewardAddr;
        configAddr = _configContractAddr;
        ballotFactoryAddr = _ballotFactoryAddr;
        lockTime = getConfigValue(ConfigNames.UNSTAKE_DURATION);
    }

    function audit(address _ballot) external returns (bool) {
        if(ballotTypes[_ballot] == T_CONFIG) {
            return auditConfig(_ballot);
        } else if (ballotTypes[_ballot] == T_LIST_TOKEN) {
            return auditListToken(_ballot);
        } else if (ballotTypes[_ballot] == T_TOKEN) {
            return auditToken(_ballot);
        } else {
            revert('DemaxGovernance: UNKNOWN_TYPE');
        }
    }

    function auditConfig(address _ballot) public returns (bool) {
        bool result = IDemaxBallot(_ballot).end();
        require(result, 'DemaxGovernance: NO_PASS');
        uint value = IDemaxBallot(_ballot).value();
        bytes32 name = configBallots[_ballot];
        result = IDemaxConfig(configAddr).changeConfigValue(name, value);
        if (name == ConfigNames.UNSTAKE_DURATION) {
            lockTime = value;
        } else if (name == ConfigNames.PRODUCE_DGAS_RATE) {
            _changeAmountPerBlock(value);
        }
        emit ConfigAudited(name, _ballot, value);
        return result;
    }

    function auditListToken(address _ballot) public returns (bool) {
        bool result = IDemaxBallot(_ballot).end();
        address token = tokenBallots[_ballot];
        address user = tokenUsers[token];
        require(ITokenRegistry(configAddr).tokenStatus(token) == ITokenRegistry(configAddr).REGISTERED(), 'DemaxGovernance: AUDITED');
        uint status = result ? ITokenRegistry(configAddr).PENDING() : ITokenRegistry(configAddr).CLOSED();
        uint amount = applyTokenOf[user][token];
        (uint burnAmount, uint rewardAmount, uint refundAmount) = (0, 0, 0);
        if (result) {
            burnAmount = amount * getConfigValue(ConfigNames.LIST_TOKEN_SUCCESS_BURN_PRECENT) / IDemaxConfig(configAddr).PERCENT_DENOMINATOR();
            rewardAmount = amount - burnAmount;
            if (burnAmount > 0) {
                TransferHelper.safeTransfer(baseToken, address(0), burnAmount);
                totalSupply = totalSupply.sub(burnAmount);
            }
            if (rewardAmount > 0) {
                rewardOf[rewardAddr] = rewardOf[rewardAddr].add(rewardAmount);
                ballotOf[_ballot] = ballotOf[_ballot].add(rewardAmount);
                _rewardTransfer(rewardAddr, _ballot, rewardAmount);
            }
            ITokenRegistry(configAddr).publishToken(token);
        } else {
            burnAmount = amount * getConfigValue(ConfigNames.LIST_TOKEN_FAILURE_BURN_PRECENT) / IDemaxConfig(configAddr).PERCENT_DENOMINATOR();
            refundAmount = amount - burnAmount;
            if (burnAmount > 0) TransferHelper.safeTransfer(baseToken, address(0), burnAmount);
            if (refundAmount > 0) TransferHelper.safeTransfer(baseToken, user, refundAmount);
            totalSupply = totalSupply.sub(amount);
            ITokenRegistry(configAddr).updateToken(token, status);
        }
        emit ListTokenAudited(user, token, status, burnAmount, rewardAmount, refundAmount);
        return result;
    }

    function auditToken(address _ballot) public returns (bool) {
        bool result = IDemaxBallot(_ballot).end();
        uint status = IDemaxBallot(_ballot).value();
        address token = tokenBallots[_ballot];
        address user = tokenUsers[token];
        require(ITokenRegistry(configAddr).tokenStatus(token) != status, 'DemaxGovernance: TOKEN_STATUS_NO_CHANGE');
        if (result) {
            ITokenRegistry(configAddr).updateToken(token, status);
        } else {
            status = ITokenRegistry(configAddr).tokenStatus(token);
        }
        emit TokenAudited(user, token, status, result);
        return result;
    }

    function getConfigValue(bytes32 _name) public view returns (uint) {
        return IDemaxConfig(configAddr).getConfigValue(_name);
    }

    function createConfigBallot(bytes32 _name, uint _value, uint _amount, bool _wallet, string calldata _subject, string calldata _content) external returns (address) {
        require(_value >= 0, 'DemaxGovernance: INVALID_PARAMTERS');
        { // avoids stack too deep errors
        (uint minValue, uint maxValue, uint maxSpan, uint value, uint enable) = IDemaxConfig(configAddr).getConfig(_name);
        require(enable == 1, "DemaxGovernance: CONFIG_DISABLE");
        require(_value >= minValue && _value <= maxValue, "DemaxGovernance: OUTSIDE");
        uint span = _value >= value? (_value - value) : (value - _value);
        require(maxSpan >= span, "DemaxGovernance: OVERSTEP");
        }
        require(_amount >= getConfigValue(ConfigNames.PROPOSAL_DGAS_AMOUNT), "DemaxGovernance: NOT_ENOUGH_AMOUNT_TO_PROPOSAL");
        if(_amount > 0) {
            _amount = _transferForBallot(_amount, _wallet);
            rewardOf[rewardAddr] = rewardOf[rewardAddr].add(_amount);
        }
        uint endBlockNumber = block.number + getConfigValue(ConfigNames.VOTE_DURATION);
        address ballotAddr = IDemaxBallotFactory(ballotFactoryAddr).create(msg.sender, _value, endBlockNumber, _subject, _content);
        configBallots[ballotAddr] = _name;
        uint reward = _createdBallot(ballotAddr, T_CONFIG);
        emit ConfigBallotCreated(msg.sender, _name, _value, ballotAddr, reward);
        return ballotAddr;
    }

    function createTokenBallot(address _token, uint _value, uint _amount, bool _wallet, string calldata _subject, string calldata _content) external returns (address) {
        require(!_isDefaultToken(_token), 'DemaxGovernance: DEFAULT_LIST_TOKENS_PROPOSAL_DENY');
        uint status = ITokenRegistry(configAddr).tokenStatus(_token);
        require(status == ITokenRegistry(configAddr).PENDING(), 'DemaxGovernance: ONLY_ALLOW_PENDING');
        require(_value == ITokenRegistry(configAddr).OPENED() || _value == ITokenRegistry(configAddr).CLOSED(), 'DemaxGovernance: INVALID_STATUS');
        require(status != _value, 'DemaxGovernance: STATUS_NO_CHANGE');
        require(_amount >= getConfigValue(ConfigNames.PROPOSAL_DGAS_AMOUNT), "DemaxGovernance: NOT_ENOUGH_AMOUNT_TO_PROPOSAL");
        if(_amount > 0) {
            _amount = _transferForBallot(_amount, _wallet);
            rewardOf[rewardAddr] = rewardOf[rewardAddr].add(_amount);
        }
        address ballotAddr = _createTokenBallot(T_TOKEN, _token, _value, _subject, _content);
        return ballotAddr;
    }

    function listToken(address _token, uint _amount, bool _wallet, string calldata _subject, string calldata _content) external returns (address) {
        uint status = ITokenRegistry(configAddr).tokenStatus(_token);
        require(status == ITokenRegistry(configAddr).NONE() || status == ITokenRegistry(configAddr).CLOSED(), 'DemaxGovernance: LISTED');
        require(_amount >= getConfigValue(ConfigNames.LIST_DGAS_AMOUNT), "DemaxGovernance: NOT_ENOUGH_AMOUNT_TO_LIST");
        tokenUsers[_token] = msg.sender;
        if(_amount > 0) {
            applyTokenOf[msg.sender][_token] = _transferForBallot(_amount, _wallet);
        }
        ITokenRegistry(configAddr).registryToken(_token);
        address ballotAddr = _createTokenBallot(T_LIST_TOKEN, _token, ITokenRegistry(configAddr).PENDING(), _subject, _content);
        emit TokenListed(msg.sender, _token, _amount);
        return ballotAddr;
    }

    function _createTokenBallot(uint _type, address _token, uint _value, string memory _subject, string memory _content) private returns (address) {
        uint endBlockNumber = block.number + getConfigValue(ConfigNames.VOTE_DURATION);
        address ballotAddr = IDemaxBallotFactory(ballotFactoryAddr).create(msg.sender, _value, endBlockNumber, _subject, _content);
        uint reward = _createdBallot(ballotAddr, _type);
        ballotOf[ballotAddr] = reward;
        tokenBallots[ballotAddr] = _token;
        emit TokenBallotCreated(msg.sender, _token, _value, ballotAddr, reward);
        return ballotAddr;
    }

    function collectReward(address _ballot) external returns (uint) {
        require(block.number >= IDemaxBallot(_ballot).endBlockNumber(), "DemaxGovernance: NOT_YET_ENDED");
        require(!collectUsers[_ballot][msg.sender], 'DemaxGovernance: REWARD_COLLECTED');
        uint amount = getReward(_ballot);
        _rewardTransfer(_ballot, msg.sender, amount);
        balanceOf[msg.sender] = balanceOf[msg.sender].add(amount);
        stakingSupply = stakingSupply.add(amount);
        rewardOf[msg.sender] = rewardOf[msg.sender].sub(amount);
        collectUsers[_ballot][msg.sender] = true;
        emit RewardCollected(msg.sender, _ballot, amount);
    }

    function getReward(address _ballot) public view returns (uint) {
        if (block.number < IDemaxBallot(_ballot).endBlockNumber() || collectUsers[_ballot][msg.sender]) {
            return 0;
        }
        uint amount;
        uint shares = ballotOf[_ballot];
        if (IDemaxBallot(_ballot).result()) {
            uint extra;
            uint rewardRate = getConfigValue(ConfigNames.VOTE_REWARD_PERCENT);
            if ( rewardRate > 0) {
               extra = shares * rewardRate / IDemaxConfig(configAddr).PERCENT_DENOMINATOR();
               shares -= extra;
            }
            if (msg.sender == IDemaxBallot(_ballot).proposer()) {
                amount = extra;
            }
        }

        if (IDemaxBallot(_ballot).total() > 0) {
            amount += shares * IDemaxBallot(_ballot).weight(msg.sender) / IDemaxBallot(_ballot).total();
        }
        return amount;
    }

    function addReward(uint _value) external onlyRewarder returns (bool) {
        require(_value > 0, 'DemaxGovernance: ADD_REWARD_VALUE_IS_ZERO');
        uint total = IERC20(baseToken).balanceOf(address(this));
        uint diff = total.sub(totalSupply);
        require(_value <= diff, 'DemaxGovernance: ADD_REWARD_EXCEED');
        rewardOf[rewardAddr] = rewardOf[rewardAddr].add(_value);
        totalSupply = total;
        emit RewardReceived(rewardAddr, _value);
    }

    function _rewardTransfer(address _from, address _to, uint _value) private returns (bool) {
        require(_value >= 0 && rewardOf[_from] >= _value, 'DemaxGovernance: INSUFFICIENT_BALANCE');
        rewardOf[_from] = rewardOf[_from].sub(_value);
        rewardOf[_to] = rewardOf[_to].add(_value);
        emit RewardTransfered(_from, _to, _value);
    }

    function _isDefaultToken(address _token) internal returns (bool) {
        address[] memory tokens = IDemaxConfig(configAddr).getDefaultListTokens();
        for(uint i = 0 ; i < tokens.length; i++){
            if (tokens[i] == _token) {
                return true;
            }
        }
        return false;
    }

    function _transferForBallot(uint _amount, bool _wallet) internal returns (uint) {
        if (_wallet) {
            TransferHelper.safeTransferFrom(baseToken, msg.sender, address(this), _amount);
            totalSupply += _amount;
        } else {
            _reduce(msg.sender, _amount);
        }
        return _amount;
    }

    function _createdBallot(address _ballot, uint _type) internal returns (uint) {
        uint reward = rewardOf[rewardAddr];
        ballotOf[_ballot] = reward;
        _rewardTransfer(rewardAddr, _ballot, reward);
        ballots.push(_ballot);
        ballotTypes[_ballot] = _type;
        return reward;
    }

    function ballotCount() external view returns (uint) {
        return ballots.length;
    }

    function _changeAmountPerBlock(uint _value) internal returns (bool) {
        return IDgas(baseToken).changeInterestRatePerBlock(_value);
    }

    function updateDgasGovernor(address _new) external onlyOwner {
        IDgas(baseToken).upgradeGovernance(_new);
    }

    function upgradeApproveReward() external returns (uint) {
        require(rewardOf[rewardAddr] > 0, 'DemaxGovernance: UPGRADE_NO_REWARD');
        require(IDemaxConfig(configAddr).governor() != address(this), 'DemaxGovernance: UPGRADE_NO_CHANGE');
        TransferHelper.safeApprove(baseToken, IDemaxConfig(configAddr).governor(), rewardOf[rewardAddr]);
        return rewardOf[rewardAddr]; 
    }

    function receiveReward(address _from, uint _value) external returns (bool) {
        require(_value > 0, 'DemaxGovernance: RECEIVE_REWARD_VALUE_IS_ZERO');
        TransferHelper.safeTransferFrom(baseToken, _from, address(this), _value);
        rewardOf[rewardAddr] += _value;
        totalSupply += _value;
        emit RewardReceived(_from, _value);
        return true;
    }

}
