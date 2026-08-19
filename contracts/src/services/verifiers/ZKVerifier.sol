// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../../core/errors/ArcPassErrors.sol";

/// @title IZKVerifierBackend
/// @notice Interface for a Groth16 verifier contract that validates ZK proofs.
interface IZKVerifierBackend {
    /// @notice Verify a Groth16 proof.
    /// @param  proof       The packed proof points (a, b, c).
    /// @param  publicInputs The public inputs to the circuit.
    /// @return True if the proof is valid.
    function verifyProof(
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external view returns (bool);
}

/// @title ZKVerifier
/// @notice Registry of trusted ZK verifier backends and proof validation for ArcPass.
///         Third-party dApps call `verifyProof()` to check a ZK proof without
///         trusting a single backend — the proof must pass a registered on-chain verifier.
///
/// @dev    The contract is NOT upgradeable (stateless registry, immutable trust anchor).
///         Trusted verifiers are added by the owner (multisig). Each verifier is identified
///         by a `verifierId` (uint16) and maps to an on-chain Groth16 verifier contract.
contract ZKVerifier is Ownable {
    struct VerifierInfo {
        address  backend;       // The on-chain Groth16 verifier contract
        string   name;          // Human-readable name (e.g. "ZKPassport Groth16 v1")
        uint64   addedAt;       // Block timestamp when added
        bool     active;        // Can be deactivated without removing
    }

    mapping(uint16 => VerifierInfo) public verifiers;
    uint16 public verifierCount;
    uint16[] public verifierIds;

    // Proof verification tracking
    mapping(bytes32 => bool) public proofUsed;   // nullifier → used (replay protection)
    uint256 public totalProofsVerified;

    event VerifierAdded(uint16 indexed verifierId, address backend, string name);
    event VerifierDeactivated(uint16 indexed verifierId);
    event ProofVerified(
        uint16 indexed verifierId,
        address indexed subject,
        bytes32 proofHash,
        uint256 timestamp
    );

    error ZKPass__VerifierNotFound(uint16 verifierId);
    error ZKPass__VerifierInactive(uint16 verifierId);
    error ZKPass__ProofAlreadyUsed(bytes32 proofHash);
    error ZKPass__ProofVerificationFailed(uint16 verifierId);
    error ZKPass__InvalidProof();

    constructor() Ownable(msg.sender) {}

    /// @notice Register a new trusted ZK verifier backend.
    /// @param  backend  The address of the Groth16 verifier contract.
    /// @param  name     Human-readable name for this verifier.
    /// @return verifierId The assigned ID for this verifier.
    function addVerifier(address backend, string calldata name)
        external onlyOwner returns (uint16)
    {
        if (backend == address(0)) revert ArcPass__ZeroAddress();

        uint16 id = verifierCount++;
        verifiers[id] = VerifierInfo({
            backend:  backend,
            name:     name,
            addedAt:  uint64(block.timestamp),
            active:   true
        });
        verifierIds.push(id);

        emit VerifierAdded(id, backend, name);
        return id;
    }

    /// @notice Deactivate a verifier (soft disable — no data is deleted).
    function deactivateVerifier(uint16 verifierId) external onlyOwner {
        if (verifiers[verifierId].backend == address(0)) revert ZKPass__VerifierNotFound(verifierId);
        verifiers[verifierId].active = false;
        emit VerifierDeactivated(verifierId);
    }

    /// @notice Verify a ZK proof against a registered verifier backend.
    /// @param  verifierId   The ID of the trusted verifier to use.
    /// @param  proof        The packed Groth16 proof bytes.
    /// @param  publicInputs The public inputs to the circuit.
    /// @param  subject      The address this proof is bound to (prevents relay attacks).
    /// @param  proofHash    Unique hash of the proof (nullifier — prevents replay).
    /// @return valid        True if the proof is valid and unused.
    function verifyProof(
        uint16            verifierId,
        bytes calldata    proof,
        uint256[] calldata publicInputs,
        address           subject,
        bytes32           proofHash
    ) external returns (bool valid) {
        VerifierInfo storage info = verifiers[verifierId];
        if (info.backend == address(0)) revert ZKPass__VerifierNotFound(verifierId);
        if (!info.active) revert ZKPass__VerifierInactive(verifierId);

        // Replay protection: each proof hash can only be used once
        if (proofUsed[proofHash]) revert ZKPass__ProofAlreadyUsed(proofHash);

        // Delegate to the registered Groth16 verifier
        try IZKVerifierBackend(info.backend).verifyProof(proof, publicInputs) returns (bool result) {
            valid = result;
        } catch {
            valid = false;
        }

        if (!valid) revert ZKPass__ProofVerificationFailed(verifierId);

        // Mark proof as used
        proofUsed[proofHash] = true;
        totalProofsVerified++;

        emit ProofVerified(verifierId, subject, proofHash, block.timestamp);
    }

    /// @notice Check if a proof hash has already been used (replay check).
    function isProofUsed(bytes32 proofHash) external view returns (bool) {
        return proofUsed[proofHash];
    }

    /// @notice Get all active verifier IDs.
    function getActiveVerifierIds() external view returns (uint16[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < verifierIds.length; i++) {
            if (verifiers[verifierIds[i]].active) count++;
        }
        uint16[] memory active = new uint16[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < verifierIds.length; i++) {
            if (verifiers[verifierIds[i]].active) {
                active[idx++] = verifierIds[i];
            }
        }
        return active;
    }
}
