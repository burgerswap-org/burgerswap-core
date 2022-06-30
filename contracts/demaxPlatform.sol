pragma solidity >=0.6.6;
import './libraries/ConfigNames.sol';
import './libraries/SafeMath.sol';
import './libraries/TransferHelper.sol';
import './libraries/DemaxSwapLibrary.sol';
import './interfaces/IWETH.sol';
import './interfaces/IDemaxGovernance.sol';
import './interfaces/IDemaxConfig.sol';
import './interfaces/IERC20.sol';
import './interfaces/IDemaxFactory.sol';
import './interfaces/IDemaxPair.sol';
import './interfaces/IDemaxPool.sol';
import './modules/Ownable.sol';
import './modules/ReentrancyGuard.sol';
import './interfaces/IDemaxTransferListener.sol';
import './interfaces/ITokenRegistry.sol';

contract DemaxPlatform is Ownable, ReentrancyGuard {
    uint256 public version = 1;
    address public DGAS;
    address public CONFIG;
    address public FACTORY;
    address public WETH;
    address public GOVERNANCE;
    address public TRANSFER_LISTENER;
    address public POOL;
    uint256 public constant PERCENT_DENOMINATOR = 10000;

    bool public isPause;

    event AddLiquidity(
        address indexed player,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB
    );
    event RemoveLiquidity(
        address indexed player,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB
    );
    event SwapToken(
        address indexed receiver,
        address indexed fromToken,
        address indexed toToken,
        uint256 inAmount,
        uint256 outAmount
    );

    receive() external payable {
        assert(msg.sender == WETH);
    }

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, 'DEMAX PLATFORM : EXPIRED');
        _;
    }

    modifier noneTokenCall() {
        require(ITokenRegistry(CONFIG).tokenStatus(msg.sender) == 0, 'DEMAX PLATFORM : ILLEGAL CALL');
        _;
    }

    function initialize(
        address _DGAS,
        address _CONFIG,
        address _FACTORY,
        address _WETH,
        address _GOVERNANCE,
        address _TRANSFER_LISTENER,
        address _POOL
    ) external onlyOwner {
        DGAS = _DGAS;
        CONFIG = _CONFIG;
        FACTORY = _FACTORY;
        WETH = _WETH;
        GOVERNANCE = _GOVERNANCE;
        TRANSFER_LISTENER = _TRANSFER_LISTENER;
        POOL = _POOL;
    }

    function pause() external onlyOwner {
        isPause = true;
    }

    function resume() external onlyOwner {
        isPause = false;
    }

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) internal nonReentrant noneTokenCall returns (uint256 amountA, uint256 amountB) {
        if (IDemaxFactory(FACTORY).getPair(tokenA, tokenB) == address(0)) {
            IDemaxConfig(CONFIG).addToken(tokenA);
            IDemaxConfig(CONFIG).addToken(tokenB);
            IDemaxFactory(FACTORY).createPair(tokenA, tokenB);
        }
        require(
            IDemaxConfig(CONFIG).checkPair(tokenA, tokenB),
            'DEMAX PLATFORM : ADD LIQUIDITY PAIR CONFIG CHECK FAIL'
        );
        (uint256 reserveA, uint256 reserveB) = DemaxSwapLibrary.getReserves(FACTORY, tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = DemaxSwapLibrary.quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, 'DEMAX PLATFORM : INSUFFICIENT_B_AMOUNT');
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = DemaxSwapLibrary.quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, 'DEMAX PLATFORM : INSUFFICIENT_A_AMOUNT');
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
        IDemaxFactory(FACTORY).addPlayerPair(msg.sender, IDemaxFactory(FACTORY).getPair(tokenA, tokenB));
    }

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
        ensure(deadline)
        returns (
            uint256 _amountA,
            uint256 _amountB,
            uint256 _liquidity
        )
    {
        require(!isPause, "DEMAX PAUSED");
        (_amountA, _amountB) = _addLiquidity(tokenA, tokenB, amountA, amountB, amountAMin, amountBMin);
        address pair = DemaxSwapLibrary.pairFor(FACTORY, tokenA, tokenB);
        TransferHelper.safeTransferFrom(tokenA, msg.sender, pair, _amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, pair, _amountB);

        // notify pool
        IDemaxPool(POOL).preProductivityChanged(pair, msg.sender);
        _liquidity = IDemaxPair(pair).mint(msg.sender);
        IDemaxPool(POOL).postProductivityChanged(pair, msg.sender);

        _transferNotify(msg.sender, pair, tokenA, _amountA);
        _transferNotify(msg.sender, pair, tokenB, _amountB);
        emit AddLiquidity(msg.sender, tokenA, tokenB, _amountA, _amountB);
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        uint256 deadline
    )
        external
        payable
        ensure(deadline)
        returns (
            uint256 amountToken,
            uint256 amountETH,
            uint256 liquidity
        )
    {
        require(!isPause, "DEMAX PAUSED");
        (amountToken, amountETH) = _addLiquidity(
            token,
            WETH,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountETHMin
        );
        address pair = DemaxSwapLibrary.pairFor(FACTORY, token, WETH);
        TransferHelper.safeTransferFrom(token, msg.sender, pair, amountToken);
        IWETH(WETH).deposit{value: amountETH}();
        assert(IWETH(WETH).transfer(pair, amountETH));

        // notify pool
        IDemaxPool(POOL).preProductivityChanged(pair, msg.sender);
        liquidity = IDemaxPair(pair).mint(msg.sender);
        IDemaxPool(POOL).postProductivityChanged(pair, msg.sender);

        _transferNotify(msg.sender, pair, WETH, amountETH);
        _transferNotify(msg.sender, pair, token, amountToken);
        emit AddLiquidity(msg.sender, token, WETH, amountToken, amountETH);
        if (msg.value > amountETH) TransferHelper.safeTransferETH(msg.sender, msg.value - amountETH);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) nonReentrant returns (uint256 amountA, uint256 amountB) {
        require(!isPause, "DEMAX PAUSED");
        address pair = DemaxSwapLibrary.pairFor(FACTORY, tokenA, tokenB);
        uint256 _liquidity = liquidity;
        address _tokenA = tokenA;
        address _tokenB = tokenB;

        // notify pool
        IDemaxPool(POOL).preProductivityChanged(pair, msg.sender);
        (uint256 amount0, uint256 amount1) = IDemaxPair(pair).burn(msg.sender, to, _liquidity);
        IDemaxPool(POOL).postProductivityChanged(pair, msg.sender);

        (address token0, ) = DemaxSwapLibrary.sortTokens(_tokenA, _tokenB);
        (amountA, amountB) = _tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        _transferNotify(pair, to, _tokenA, amountA);
        _transferNotify(pair, to, _tokenB, amountB);
        require(amountA >= amountAMin, 'DEMAX PLATFORM : INSUFFICIENT_A_AMOUNT');
        require(amountB >= amountBMin, 'DEMAX PLATFORM : INSUFFICIENT_B_AMOUNT');
        emit RemoveLiquidity(msg.sender, _tokenA, _tokenB, amountA, amountB);
    }

    function removeLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountToken, uint256 amountETH) {
        require(!isPause, "DEMAX PAUSED");
        (amountToken, amountETH) = removeLiquidity(
            token,
            WETH,
            liquidity,
            amountTokenMin,
            amountETHMin,
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(token, to, amountToken);
        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
        _transferNotify(address(this), to, token, amountToken);
        _transferNotify(address(this), to, WETH, amountETH);
    }

    function _getAmountsOut(
        uint256 amount,
        address[] memory path,
        uint256 percent
    ) internal view returns (uint256[] memory amountOuts) {
        amountOuts = new uint256[](path.length);
        amountOuts[0] = amount;
        for (uint256 i = 0; i < path.length - 1; i++) {
            address inPath = path[i];
            address outPath = path[i + 1];
            (uint256 reserveA, uint256 reserveB) = DemaxSwapLibrary.getReserves(FACTORY, inPath, outPath);
            uint256 outAmount = SafeMath.mul(amountOuts[i], SafeMath.sub(PERCENT_DENOMINATOR, percent));
            amountOuts[i + 1] = DemaxSwapLibrary.getAmountOut(outAmount / PERCENT_DENOMINATOR, reserveA, reserveB);
        }
    }

    function _getAmountsIn(
        uint256 amount,
        address[] memory path,
        uint256 percent
    ) internal view returns (uint256[] memory amountIn) {
        amountIn = new uint256[](path.length);
        amountIn[path.length - 1] = amount;
        for (uint256 i = path.length - 1; i > 0; i--) {
            address inPath = path[i - 1];
            address outPath = path[i];
            (uint256 reserveA, uint256 reserveB) = DemaxSwapLibrary.getReserves(FACTORY, inPath, outPath);
            uint256 inAmount = DemaxSwapLibrary.getAmountIn(amountIn[i], reserveA, reserveB);
            amountIn[i - 1] = SafeMath.add(
                SafeMath.mul(inAmount, PERCENT_DENOMINATOR) / SafeMath.sub(PERCENT_DENOMINATOR, percent),
                1
            );
        }
        amountIn = _getAmountsOut(amountIn[0], path, percent);
    }

    function swapPrecondition(address token) public view returns (bool) {
        if (token == DGAS || token == WETH) return true;
        uint256 percent = IDemaxConfig(CONFIG).getConfigValue(ConfigNames.TOKEN_TO_DGAS_PAIR_MIN_PERCENT);
        if (!existPair(WETH, DGAS)) return false;
        if (!existPair(DGAS, token)) return false;
        if (!(IDemaxConfig(CONFIG).checkPair(DGAS, token) && IDemaxConfig(CONFIG).checkPair(WETH, token))) return false;
        if (!existPair(WETH, token)) return true;
        if (percent == 0) return true;
        (uint256 reserveDGAS, ) = DemaxSwapLibrary.getReserves(FACTORY, DGAS, token);
        (uint256 reserveWETH, ) = DemaxSwapLibrary.getReserves(FACTORY, WETH, token);
        (uint256 reserveWETH2, uint256 reserveDGAS2) = DemaxSwapLibrary.getReserves(FACTORY, WETH, DGAS);
        uint256 dgasValue = SafeMath.mul(reserveDGAS, reserveWETH2) / reserveDGAS2;
        uint256 limitValue = SafeMath.mul(SafeMath.add(dgasValue, reserveWETH), percent) / PERCENT_DENOMINATOR;
        return dgasValue >= limitValue;
    }
         
    function checkPath(address _path, address[] memory _paths) public pure returns (bool) {
        uint count;
        for(uint i; i<_paths.length; i++) {
            if(_paths[i] == _path) {
                count++;
            }
        }
        if(count == 1) {
            return true;
        } else {
            return false;
        }
    }

    function _swap(
        uint256[] memory amounts,
        address[] memory path,
        address _to
    ) internal nonReentrant noneTokenCall {
        require(!isPause, "DEMAX PAUSED");
        require(swapPrecondition(path[path.length - 1]), 'DEMAX PLATFORM : CHECK DGAS/TOKEN TO VALUE FAIL');
        for (uint256 i; i < path.length - 1; i++) {
            require(checkPath(path[i], path) && checkPath(path[i + 1], path), 'DEMAX PLATFORM : INVALID PATH');
            (address input, address output) = (path[i], path[i + 1]);
            require(swapPrecondition(input), 'DEMAX PLATFORM : CHECK DGAS/TOKEN VALUE FROM FAIL');
            require(IDemaxConfig(CONFIG).checkPair(input, output), 'DEMAX PLATFORM : SWAP PAIR CONFIG CHECK FAIL');
            (address token0, address token1) = DemaxSwapLibrary.sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = input == token0
                ? (uint256(0), amountOut)
                : (amountOut, uint256(0));
            address to = i < path.length - 2 ? DemaxSwapLibrary.pairFor(FACTORY, output, path[i + 2]) : _to;

            // add k check
            address pair = DemaxSwapLibrary.pairFor(FACTORY, input, output);
            (uint reserve0, uint resereve1, ) = IDemaxPair(pair).getReserves();
            uint kBefore = SafeMath.mul(reserve0, resereve1);

            IDemaxPair(pair).swap(amount0Out, amount1Out, to, new bytes(0));

            (reserve0, resereve1, ) = IDemaxPair(pair).getReserves();
            uint kAfter = SafeMath.mul(reserve0, resereve1);
            require(kBefore <= kAfter, "Burger K");

            if (amount0Out > 0)
                _transferNotify(DemaxSwapLibrary.pairFor(FACTORY, input, output), to, token0, amount0Out);
            if (amount1Out > 0)
                _transferNotify(DemaxSwapLibrary.pairFor(FACTORY, input, output), to, token1, amount1Out);
        }
        emit SwapToken(_to, path[0], path[path.length - 1], amounts[0], amounts[path.length - 1]);
    }

    function _swapFee(
        uint256[] memory amounts,
        address[] memory path,
        uint256 percent
    ) internal {
        if(percent == 0) return;
        for (uint256 i = 0; i < path.length - 1; i++) {
            uint256 fee = SafeMath.mul(amounts[i], percent) / PERCENT_DENOMINATOR;
            address input = path[i];
            address output = path[i + 1];
            address currentPair = DemaxSwapLibrary.pairFor(FACTORY, input, output);

            if (input == DGAS) {
                IDemaxPair(currentPair).swapFee(fee, DGAS, POOL);
                _transferNotify(currentPair, POOL, DGAS, fee);
            } else {
                IDemaxPair(currentPair).swapFee(fee, input, DemaxSwapLibrary.pairFor(FACTORY, input, DGAS));
                (uint256 reserveIn, uint256 reserveDGAS) = DemaxSwapLibrary.getReserves(FACTORY, input, DGAS);
                uint256 feeOut = DemaxSwapLibrary.getAmountOut(fee, reserveIn, reserveDGAS);
                IDemaxPair(DemaxSwapLibrary.pairFor(FACTORY, input, DGAS)).swapFee(feeOut, DGAS, POOL);
                _transferNotify(currentPair, DemaxSwapLibrary.pairFor(FACTORY, input, DGAS), input, fee);
                _transferNotify(DemaxSwapLibrary.pairFor(FACTORY, input, DGAS), POOL, DGAS, feeOut);
                fee = feeOut;
            }

            if (fee > 0) IDemaxPool(POOL).addRewardFromPlatform(currentPair, fee);
        }
    }

    function _getSwapFeePercent() internal view returns (uint256) {
        return IDemaxConfig(CONFIG).getConfigValue(ConfigNames.SWAP_FEE_PERCENT);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {

        uint256 percent = _getSwapFeePercent();
        amounts = _getAmountsOut(amountIn, path, percent);
        require(amounts[amounts.length - 1] >= amountOutMin, 'DEMAX PLATFORM : INSUFFICIENT_OUTPUT_AMOUNT');
        address pair = DemaxSwapLibrary.pairFor(FACTORY, path[0], path[1]);
        _innerTransferFrom(
            path[0],
            msg.sender,
            pair,
            SafeMath.mul(amountIn, SafeMath.sub(PERCENT_DENOMINATOR, percent)) / PERCENT_DENOMINATOR
        );
        _swap(amounts, path, to);
        
        if(percent > 0) {
            _innerTransferFrom(path[0], msg.sender, pair, SafeMath.mul(amounts[0], percent) / PERCENT_DENOMINATOR);
            _swapFee(amounts, path, percent);
        }
    }

    function _innerTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal {
        TransferHelper.safeTransferFrom(token, from, to, amount);
        _transferNotify(from, to, token, amount);
    }

    function _innerTransferWETH(address to, uint256 amount) internal {
        assert(IWETH(WETH).transfer(to, amount));
        _transferNotify(address(this), to, WETH, amount);
    }

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256[] memory amounts) {
        require(path[0] == WETH, 'DEMAX PLATFORM : INVALID_PATH');
        uint256 percent = _getSwapFeePercent();
        amounts = _getAmountsOut(msg.value, path, percent);
        require(amounts[amounts.length - 1] >= amountOutMin, 'DEMAX PLATFORM : INSUFFICIENT_OUTPUT_AMOUNT');
        address pair = DemaxSwapLibrary.pairFor(FACTORY, path[0], path[1]);
        IWETH(WETH).deposit{
            value: SafeMath.mul(amounts[0], SafeMath.sub(PERCENT_DENOMINATOR, percent)) / PERCENT_DENOMINATOR
        }();
        _innerTransferWETH(
            pair,
            SafeMath.mul(amounts[0], SafeMath.sub(PERCENT_DENOMINATOR, percent)) / PERCENT_DENOMINATOR
        );
        _swap(amounts, path, to);

        if(percent > 0) {
            IWETH(WETH).deposit{value: SafeMath.mul(amounts[0], percent) / PERCENT_DENOMINATOR}();
            _innerTransferWETH(pair, SafeMath.mul(amounts[0], percent) / PERCENT_DENOMINATOR);
            _swapFee(amounts, path, percent);
        }
    }

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WETH, 'DEMAX PLATFORM : INVALID_PATH');
        uint256 percent = _getSwapFeePercent();
        amounts = _getAmountsOut(amountIn, path, percent);
        require(amounts[amounts.length - 1] >= amountOutMin, 'DEMAX PLATFORM : INSUFFICIENT_OUTPUT_AMOUNT');
        address pair = DemaxSwapLibrary.pairFor(FACTORY, path[0], path[1]);
        _innerTransferFrom(
            path[0],
            msg.sender,
            pair,
            SafeMath.mul(amountIn, SafeMath.sub(PERCENT_DENOMINATOR, percent)) / PERCENT_DENOMINATOR
        );
        _swap(amounts, path, address(this));

        if(percent > 0) {
            _innerTransferFrom(path[0], msg.sender, pair, SafeMath.mul(amounts[0], percent) / PERCENT_DENOMINATOR);
            _swapFee(amounts, path, percent);
        }

        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        uint256 percent = _getSwapFeePercent();
        amounts = _getAmountsIn(amountOut, path, percent);
        require(amounts[0] <= amountInMax, 'DEMAX PLATFORM : EXCESSIVE_INPUT_AMOUNT');
        address pair = DemaxSwapLibrary.pairFor(FACTORY, path[0], path[1]);

        _innerTransferFrom(
            path[0],
            msg.sender,
            pair,
            SafeMath.mul(amounts[0], SafeMath.sub(PERCENT_DENOMINATOR, percent)) / PERCENT_DENOMINATOR
        );
        _swap(amounts, path, to);

        if(percent > 0) {
            _innerTransferFrom(path[0], msg.sender, pair, SafeMath.mul(amounts[0], percent) / PERCENT_DENOMINATOR);
            _swapFee(amounts, path, percent);
        }
    }

    function swapTokensForExactETH(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WETH, 'DEMAX PLATFORM : INVALID_PATH');
        uint256 percent = _getSwapFeePercent();
        amounts = _getAmountsIn(amountOut, path, percent);
        require(amounts[0] <= amountInMax, 'DEMAX PLATFORM : EXCESSIVE_INPUT_AMOUNT');
        address pair = DemaxSwapLibrary.pairFor(FACTORY, path[0], path[1]);
        _innerTransferFrom(
            path[0],
            msg.sender,
            pair,
            SafeMath.mul(amounts[0], SafeMath.sub(PERCENT_DENOMINATOR, percent)) / PERCENT_DENOMINATOR
        );
        _swap(amounts, path, address(this));
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);

        if(percent > 0) {
            _innerTransferFrom(path[0], msg.sender, pair, SafeMath.mul(amounts[0], percent) / PERCENT_DENOMINATOR);
            _swapFee(amounts, path, percent);
        }
    }

    function swapETHForExactTokens(
        uint256 amountOut,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256[] memory amounts) {
        require(path[0] == WETH, 'DEMAX PLATFORM : INVALID_PATH');
        uint256 percent = _getSwapFeePercent();
        amounts = _getAmountsIn(amountOut, path, percent);
        require(amounts[0] <= msg.value, 'DEMAX PLATFORM : EXCESSIVE_INPUT_AMOUNT');

        IWETH(WETH).deposit{
            value: SafeMath.mul(amounts[0], SafeMath.sub(PERCENT_DENOMINATOR, percent)) / PERCENT_DENOMINATOR
        }();
        address pair = DemaxSwapLibrary.pairFor(FACTORY, path[0], path[1]);
        _innerTransferWETH(
            pair,
            SafeMath.mul(amounts[0], SafeMath.sub(PERCENT_DENOMINATOR, percent)) / PERCENT_DENOMINATOR
        );
        _swap(amounts, path, to);

        if(percent > 0) {
            IWETH(WETH).deposit{value: SafeMath.mul(amounts[0], percent) / PERCENT_DENOMINATOR}();
            _innerTransferWETH(pair, SafeMath.mul(amounts[0], percent) / PERCENT_DENOMINATOR);
            _swapFee(amounts, path, percent);
        }

        if (msg.value > amounts[0]) TransferHelper.safeTransferETH(msg.sender, msg.value - amounts[0]);
    }

    function _transferNotify(
        address from,
        address to,
        address token,
        uint256 amount
    ) internal {
        IDemaxTransferListener(TRANSFER_LISTENER).transferNotify(from, to, token, amount);
    }

    function existPair(address tokenA, address tokenB) public view returns (bool) {
        return IDemaxFactory(FACTORY).getPair(tokenA, tokenB) != address(0);
    }

    function getReserves(address tokenA, address tokenB) public view returns (uint256, uint256) {
        return DemaxSwapLibrary.getReserves(FACTORY, tokenA, tokenB);
    }

    function pairFor(address tokenA, address tokenB) public view returns (address) {
        return DemaxSwapLibrary.pairFor(FACTORY, tokenA, tokenB);
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public view returns (uint256 amountOut) {
        uint256 percent = _getSwapFeePercent();
        uint256 amount = SafeMath.mul(amountIn, SafeMath.sub(PERCENT_DENOMINATOR, percent)) / PERCENT_DENOMINATOR;
        return DemaxSwapLibrary.getAmountOut(amount, reserveIn, reserveOut);
    }

    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) public view returns (uint256 amountIn) {
        uint256 percent = _getSwapFeePercent();
        uint256 amount = DemaxSwapLibrary.getAmountIn(amountOut, reserveIn, reserveOut);
        return SafeMath.mul(amount, PERCENT_DENOMINATOR) / SafeMath.sub(PERCENT_DENOMINATOR, percent);
    }

    function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory amounts) {
        uint256 percent = _getSwapFeePercent();
        return _getAmountsOut(amountIn, path, percent);
    }

    function getAmountsIn(uint256 amountOut, address[] memory path) public view returns (uint256[] memory amounts) {
        uint256 percent = _getSwapFeePercent();
        return _getAmountsIn(amountOut, path, percent);
    }

    function migrateLiquidity(address pair, address tokenA, address tokenB, address[] calldata users) external onlyOwner {
        if (IDemaxFactory(FACTORY).getPair(tokenA, tokenB) == address(0)) {
            IDemaxFactory(FACTORY).createPair(tokenA, tokenB);
        }
        address newPair = IDemaxFactory(FACTORY).getPair(tokenA, tokenB);
        for(uint i = 0; i < users.length; i++) {
            uint liquidity = IDemaxPair(pair).balanceOf(users[i]);
            if(liquidity > 0) {
                IDemaxPair(pair).burn(users[i], newPair, liquidity);
                IDemaxPair(newPair).mint(users[i]);
                IDemaxFactory(FACTORY).addPlayerPair(users[i], newPair);
            }
        }

        IDemaxTransferListener(TRANSFER_LISTENER).upgradeProdutivity(pair, newPair);
        
    }
}
