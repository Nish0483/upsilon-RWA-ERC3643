// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISecurityToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IIdentityRegistry {
    function isVerified(address user) external view returns (bool);
}

/**
 * @title MultiPropertySale
 * @dev Primary market for many ERC-3643 tokens at once. Investors pay native ETH
 *      and receive the chosen property's security token. Because every listed
 *      token shares a single IdentityRegistry, this contract only needs to be
 *      registered as a verified identity once to be able to hold/transfer them.
 */
contract MultiPropertySale is Ownable, ReentrancyGuard {
    IIdentityRegistry public immutable identityRegistry;
    address public treasury;

    /// @dev Wei per 1 full token (1e18 base units), keyed by token address.
    mapping(address => uint256) public tokenPriceWei;
    mapping(address => uint256) public tokensAvailable;
    mapping(address => bool) public listed;

    event TokenListed(address indexed token, uint256 priceWei);
    event TokensPurchased(address indexed token, address indexed buyer, uint256 tokenAmount, uint256 ethPaid);
    event InventoryDeposited(address indexed token, uint256 amount);
    event TokenPriceUpdated(address indexed token, uint256 newPrice);

    constructor(address identityRegistry_, address treasury_) Ownable(msg.sender) {
        identityRegistry = IIdentityRegistry(identityRegistry_);
        treasury = treasury_;
    }

    function listToken(address token, uint256 priceWei) external onlyOwner {
        require(token != address(0), "MPS: zero token");
        require(priceWei > 0, "MPS: zero price");
        listed[token] = true;
        tokenPriceWei[token] = priceWei;
        emit TokenListed(token, priceWei);
    }

    function depositTokens(address token, uint256 amount) external onlyOwner {
        require(listed[token], "MPS: not listed");
        require(ISecurityToken(token).transferFrom(msg.sender, address(this), amount), "MPS: deposit failed");
        tokensAvailable[token] += amount;
        emit InventoryDeposited(token, amount);
    }

    function buy(address token, uint256 tokenAmount) external payable nonReentrant {
        require(listed[token], "MPS: not listed");
        require(tokenAmount > 0, "MPS: zero amount");
        require(tokensAvailable[token] >= tokenAmount, "MPS: insufficient inventory");
        require(identityRegistry.isVerified(msg.sender), "MPS: KYC required");

        uint256 ethCost = (tokenAmount * tokenPriceWei[token]) / 1e18;
        require(ethCost > 0, "MPS: below minimum");
        require(msg.value == ethCost, "MPS: incorrect ETH sent");

        tokensAvailable[token] -= tokenAmount;
        require(ISecurityToken(token).transfer(msg.sender, tokenAmount), "MPS: token transfer failed");

        (bool sent, ) = treasury.call{value: ethCost}("");
        require(sent, "MPS: treasury transfer failed");

        emit TokensPurchased(token, msg.sender, tokenAmount, ethCost);
    }

    function setTokenPrice(address token, uint256 newPrice) external onlyOwner {
        require(listed[token], "MPS: not listed");
        require(newPrice > 0, "MPS: zero price");
        tokenPriceWei[token] = newPrice;
        emit TokenPriceUpdated(token, newPrice);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        treasury = newTreasury;
    }
}
