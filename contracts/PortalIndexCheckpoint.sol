// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title PortalIndexCheckpoint
/// @notice Anchors PortalIndex's indexed state on-chain. The indexer periodically
///         publishes a hash of everything it has indexed up to a finalized block,
///         so anyone can recompute the hash from chain data and verify the index.
contract PortalIndexCheckpoint {
    address public owner;
    uint256 public count;
    uint256 public latestBlock;

    /// blockNumber => state hash published for that block
    mapping(uint256 => bytes32) public checkpoints;

    event Checkpoint(
        uint256 indexed blockNumber,
        bytes32 stateHash,
        address indexed publisher,
        uint256 timestamp
    );
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error BlockNotIncreasing(uint256 latest, uint256 given);
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Publish the state hash for a finalized block. Block numbers must increase.
    function publish(uint256 blockNumber, bytes32 stateHash) external onlyOwner {
        if (blockNumber <= latestBlock) revert BlockNotIncreasing(latestBlock, blockNumber);
        checkpoints[blockNumber] = stateHash;
        latestBlock = blockNumber;
        count += 1;
        emit Checkpoint(blockNumber, stateHash, msg.sender, block.timestamp);
    }

    /// @notice Check a locally computed hash against the one anchored on-chain.
    function verify(uint256 blockNumber, bytes32 stateHash) external view returns (bool) {
        return checkpoints[blockNumber] == stateHash && stateHash != bytes32(0);
    }

    /// @notice Latest published checkpoint.
    function latest() external view returns (uint256 blockNumber, bytes32 stateHash) {
        return (latestBlock, checkpoints[latestBlock]);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
