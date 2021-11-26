// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CRLPresale is AccessControl, ReentrancyGuard {

    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    address public immutable CRL;
    uint256 private immutable CRL_DECIMALS;

    uint256 public immutable SOFT_CAP;
    uint256 public tokenSold;
    uint256 public price = 500000;
    uint256 public endTime;

    address[] public PAYMENT_METHODS;
    mapping (address => uint256[]) public amounts;
    mapping (address => uint256) private _paymentMethodExists;
    uint256[] private refundable;

    modifier afterStartAndBeforeEnd() {
        require(endTime > block.timestamp, "Already ended or not started");
        _;
    }

    constructor(address _CRL, uint256 _CRL_DECIMALS) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(SIGNER_ROLE, _msgSender());
        CRL = _CRL;
        CRL_DECIMALS = _CRL_DECIMALS;
        SOFT_CAP = 1000000000 * (10 ** _CRL_DECIMALS);
    }

    function paymentMethodsLength() external view returns (uint256) {
        return PAYMENT_METHODS.length;
    }

    function start() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(endTime == 0, "Already started");
        endTime = block.timestamp + 10368000;
        refundable.push(0);
    }

    function increaseEndTime(uint256 toIncrease) external onlyRole(DEFAULT_ADMIN_ROLE) afterStartAndBeforeEnd {
        endTime = endTime + toIncrease;
    }

    function setPrice(uint256 _price) external onlyRole(DEFAULT_ADMIN_ROLE) {
        price = _price;
    }

    function addPaymentMethod(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(token != CRL, "Cannot add CRL as payment method");
        require(_paymentMethodExists[token] == 0, "Payment method already exists");
        PAYMENT_METHODS.push(token);
        _paymentMethodExists[token] = PAYMENT_METHODS.length;
        refundable.push(0);
    }

    function buy(address tokenToPay, uint256 amountToPay, uint256 amountToReceive, uint256 deadline, bytes calldata signature) external payable afterStartAndBeforeEnd nonReentrant {
        require(hasRole(SIGNER_ROLE, ECDSA.recover(ECDSA.toEthSignedMessageHash(keccak256(abi.encodePacked(tokenToPay, amountToPay, amountToReceive, deadline))), signature)), "Invalid signature");
        require(deadline >= block.timestamp, "Signature deadline passed");
        require(amountToPay > 0 && amountToReceive >= 1 * (10 ** CRL_DECIMALS), "Cannot pay zero or receive less than one");
        require(amountToReceive <= (IERC20(CRL).balanceOf(address(this)) - refundable[0]), "Cannot buy this much");
        uint256 ID = _paymentMethodExists[tokenToPay];
        require(ID != 0, "Wrong payment method");
        if (tokenToPay == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
            require(amountToPay == msg.value);
        }
        else {
            require(msg.value == 0, "Cannot send ETH while paying with token");
            require(IERC20(tokenToPay).transferFrom(_msgSender(), address(this), amountToPay));
        }
        tokenSold += amountToReceive;
        if (tokenSold < SOFT_CAP) {
            while (amounts[_msgSender()].length <= ID) {
                amounts[_msgSender()].push(0);
            }
            amounts[_msgSender()][0] += amountToReceive;
            refundable[0] += amountToReceive;
            amounts[_msgSender()][ID] += amountToPay;
            refundable[ID] += amountToPay;
        }
        else {
            require(IERC20(CRL).transfer(_msgSender(), amountToReceive));
        }
    }

    function redeem() external nonReentrant {
        require(IERC20(CRL).transfer(_msgSender(), amounts[_msgSender()][0]));
        for (uint256 i; i < amounts[_msgSender()].length; i++) {
            refundable[i] -= amounts[_msgSender()][i];
        }
        delete amounts[_msgSender()];
    }

    function refund() external nonReentrant {
        require(block.timestamp > endTime, "Not ended yet");
        require(tokenSold < SOFT_CAP, "Soft cap is reached");
        for (uint256 i; i < amounts[_msgSender()].length; i++) {
            uint256 toRefund = amounts[_msgSender()][i];
            if (toRefund > 0) {
                if (i != 0) {
                    address token = PAYMENT_METHODS[i - 1];
                    if (token == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
                        payable(_msgSender()).transfer(toRefund);
                    }
                    else {
                        require(IERC20(token).transfer(_msgSender(), toRefund));
                    }
                }
                else {
                    tokenSold -= toRefund;
                }
                refundable[i] -= toRefund;
            }
        }
        delete amounts[_msgSender()];
    }

    function getToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (token == CRL) {
            require(block.timestamp > endTime, "Not ended yet");
            require(IERC20(CRL).transfer(_msgSender(), (IERC20(CRL).balanceOf(address(this)) - refundable[0])));
        }
        else {
            uint256 toGet;
            if (token == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
                toGet = address(this).balance;
            }
            else {
                toGet = IERC20(token).balanceOf(address(this));
            }
            uint256 ID = _paymentMethodExists[token];
            if (ID != 0 && tokenSold < SOFT_CAP) {
                toGet -= refundable[ID];
            }
            if (toGet > 0) {
                if (token == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
                    payable(_msgSender()).transfer(toGet);
                }
                else {
                    require(IERC20(token).transfer(_msgSender(), toGet));
                }
            }
        }
    }
}