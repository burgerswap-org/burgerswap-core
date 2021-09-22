pragma solidity >=0.6.6;

import './libraries/SafeMath.sol';
import './libraries/TransferHelper.sol';
import './modules/ProjectConfigable.sol';

interface IDemaxProjectFactory {
    function initialize (address _mintToken, address _admin, string calldata _intro) external;
    function mintToken() external view returns (address);
}

interface IDemaxProjectPool {
    function initialize (address _mintToken, address _burgerToken, address _lpToken, address _factory) external;
}

contract DemaxProjectDeploy is ProjectConfigable {
    uint public version = 1;
    mapping(address => address) public factoryList;
    mapping(address => mapping(address => address)) public poolList;
    address[] public factories;
    uint public factoryListLength;
    mapping(address => uint) public factoryPoolListLength;
    mapping(address => address[]) public factoryPools;
    bytes32 public factoryByteCodeHash;
    bytes32 public poolByteCodeHash;
    address public burgerToken;
    mapping(address => bool) public disabledFactory;
    mapping(address => bool) public disabledPool;

    event FactoryCreated(address indexed token, address indexed factory);
    event PoolCreated(address indexed factory, address indexed lpToken, address pool);

    function initialize (address _burgerToken, bytes32 _factoryByteCodeHash, bytes32 _poolByteCodeHash) external onlyOwner {
        burgerToken = _burgerToken;
        factoryByteCodeHash = _factoryByteCodeHash;
        poolByteCodeHash = _poolByteCodeHash;
    }

    function createFactory(
        address _mintToken,
        string calldata _intro,
        bytes calldata _bytecode
    ) external onlyDev returns (address factory) {
        require(factoryList[_mintToken] == address(0), 'DemaxProjectDeploy: FACTORY_EXISTS'); // single check is sufficient
        bytes32 salt = keccak256(abi.encodePacked(_mintToken));
        bytes memory bytecode = _bytecode;
        require(keccak256(bytecode) == factoryByteCodeHash, "INVALID BYTECODE.");
        
        assembly {
            factory := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        factoryListLength ++;
        factoryList[_mintToken] = factory;
        factories.push(factory);
        ProjectConfigable(factory).setupConfig(config);
        IDemaxProjectFactory(factory).initialize(_mintToken, ProjectConfigable(config).admin(), _intro);
        emit FactoryCreated(_mintToken, factory);
        return factory;
    }

    function createPool(
        address _factory,
        address _lpToken,
        bytes calldata _bytecode
    ) external onlyDev returns (address pool) {
        require(poolList[_factory][_lpToken]== address(0), 'DemaxProjectDeploy: POOL_EXISTS'); // single check is sufficient
        bytes32 salt = keccak256(abi.encodePacked(_factory, _lpToken));
        bytes memory bytecode = _bytecode;
        require(keccak256(bytecode) == poolByteCodeHash, "INVALID BYTECODE.");
        
        assembly {
            pool := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        factoryPoolListLength[_factory] ++;
        poolList[_factory][_lpToken] = pool;
        factoryPools[_factory].push(pool);
        IDemaxProjectPool(pool).initialize(
            IDemaxProjectFactory(_factory).mintToken(), 
            burgerToken,
            _lpToken,
            _factory
        );
        emit PoolCreated(_factory, _lpToken, pool);
        return pool;
    }

    function getPoolByIndex(address _factory, uint _index) external view returns (address) {
        return factoryPools[_factory][_index];
    }

    function getFactoryList() external view returns (address[] memory) {
        return factories;
    }

    function getPoolList(address _factory) external view returns (address[] memory) {
        return factoryPools[_factory];
    }

    function setFactory(address _factory, bool _value) external onlyDev returns (bool) {
        disabledFactory[_factory] = _value;
        return _value;
    }

    function setPool(address _pool, bool _value) external onlyDev returns (bool) {
        disabledPool[_pool] = _value;
        return _value;
    }
}