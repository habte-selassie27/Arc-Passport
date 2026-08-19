// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../../core/errors/ArcPassErrors.sol";

/// @title IAttestationRegistryExternal
/// @notice Minimal interface for AttestationRegistry used by the adapter.
interface IAttestationRegistryExternal {
    function attest(
        address subject,
        bytes32 schemaId,
        bytes32 dataCommitment,
        uint256 expiresAt
    ) external returns (bytes32 claimId);
}

/// @title IZKVerifierExternal
/// @notice Minimal interface for ZKVerifier used by the adapter.
interface IZKVerifierExternal {
    function verifyProof(
        uint16            verifierId,
        bytes calldata    proof,
        uint256[] calldata publicInputs,
        address           subject,
        bytes32           proofHash
    ) external returns (bool valid);
}

/// @title ZKPassportAdapter
/// @notice Bridges external ZK passport proofs (NFC passport, zkPass, etc.) into
///         ArcPass attestations. The flow:
///
///         1. User generates a ZK proof off-chain (NFC scan → Groth16 proof)
///         2. User submits the proof to this contract
///         3. Contract verifies the proof via ZKVerifier
///         4. If valid, issues an attestation to AttestationRegistry
///
/// @dev    This contract holds no state beyond configuration. It is the bridge
///         between external ZK systems and ArcPass's attestation layer.
///         The issuer role on AttestationRegistry must be granted to this contract.
contract ZKPassportAdapter is Ownable {
    IAttestationRegistryExternal public immutable attestationRegistry;
    IZKVerifierExternal public immutable zkVerifier;

    // Dual-layer proof schema IDs (must match SchemaIds.sol)
    bytes32 public immutable PASSPORT_AUTHENTICITY_SCHEMA;
    bytes32 public immutable ZK_ATTRIBUTE_PROOF_SCHEMA;

    // Maximum proof age (7 days) — prevents stale proofs
    uint256 public constant MAX_PROOF_AGE = 7 days;

    // Trusted document types
    mapping(string => bool) public trustedDocumentTypes;

    event ProofAccepted(
        address indexed subject,
        uint16   indexed verifierId,
        bytes32  indexed proofHash,
        bytes32  claimId,
        string   documentType,
        uint256  timestamp
    );
    event DocumentTypeUpdated(string documentType, bool trusted);

    error ZKPass__ProofTooOld(uint256 proofTimestamp, uint256 maxAge);
    error ZKPass__UntrustedDocumentType(string documentType);
    error ZKPass__NullifierAlreadyUsed(bytes32 nullifier);

    constructor(
        address _attestationRegistry,
        address _zkVerifier,
        bytes32 _passportAuthSchema,
        bytes32 _zkAttributeSchema
    ) Ownable(msg.sender) {
        attestationRegistry = IAttestationRegistryExternal(_attestationRegistry);
        zkVerifier = IZKVerifierExternal(_zkVerifier);
        PASSPORT_AUTHENTICITY_SCHEMA = _passportAuthSchema;
        ZK_ATTRIBUTE_PROOF_SCHEMA = _zkAttributeSchema;
    }

    /// @notice Add or remove a trusted document type.
    function setDocumentType(string calldata documentType, bool trusted) external onlyOwner {
        trustedDocumentTypes[documentType] = trusted;
        emit DocumentTypeUpdated(documentType, trusted);
    }

    /// @notice Submit a ZK passport proof for verification and attestation issuance.
    ///
    /// @param  verifierId      The ID of the trusted ZK verifier to use.
    /// @param  proof           The packed Groth16 proof bytes.
    /// @param  publicInputs    Public inputs to the ZK circuit.
    /// @param  proofHash       Unique hash of this proof (nullifier — replay protection).
    /// @param  documentType    The type of document (e.g. "passport", "national_id").
    /// @param  issuedAt        Timestamp when the document was issued (from the proof).
    /// @param  expiresAt       When the attestation should expire (0 = never).
    /// @return claimId         The attestation claim ID.
    function submitProof(
        uint16            verifierId,
        bytes calldata    proof,
        uint256[] calldata publicInputs,
        bytes32           proofHash,
        string calldata   documentType,
        uint256           issuedAt,
        uint256           expiresAt
    ) external returns (bytes32 claimId) {
        // Validate document type
        if (!trustedDocumentTypes[documentType]) revert ZKPass__UntrustedDocumentType(documentType);

        // Validate proof freshness
        if (issuedAt + MAX_PROOF_AGE < block.timestamp) {
            revert ZKPass__ProofTooOld(issuedAt, MAX_PROOF_AGE);
        }

        // Verify the ZK proof on-chain via ZKVerifier
        bool valid = zkVerifier.verifyProof(
            verifierId,
            proof,
            publicInputs,
            msg.sender,
            proofHash
        );
        if (!valid) revert ArcPass__VerificationFailed(msg.sender, PASSPORT_AUTHENTICITY_SCHEMA);

        // Issue Layer 1: Passport Authenticity attestation
        // dataCommitment = keccak256(abi.encode(proofHash, documentType, issuedAt))
        bytes32 dataCommitment = keccak256(
            abi.encode(proofHash, documentType, issuedAt)
        );

        claimId = attestationRegistry.attest(
            msg.sender,
            PASSPORT_AUTHENTICITY_SCHEMA,
            dataCommitment,
            expiresAt
        );

        emit ProofAccepted(
            msg.sender,
            verifierId,
            proofHash,
            claimId,
            documentType,
            block.timestamp
        );
    }

    /// @notice Submit a ZK attribute proof (Layer 2) — proves a specific attribute
    ///         without revealing the underlying data.
    ///
    /// @param  verifierId      The ZK verifier to use.
    /// @param  proof           The Groth16 proof bytes.
    /// @param  publicInputs    Public inputs (e.g. [age >= 18, nullifier]).
    /// @param  proofHash       Unique proof hash.
    /// @param  attributeHash   Hash of the attribute being proven.
    /// @param  expiresAt       Attestation expiry.
    /// @return claimId         The attestation claim ID.
    function submitAttributeProof(
        uint16            verifierId,
        bytes calldata    proof,
        uint256[] calldata publicInputs,
        bytes32           proofHash,
        bytes32           attributeHash,
        uint256           expiresAt
    ) external returns (bytes32 claimId) {
        // Verify the ZK proof
        bool valid = zkVerifier.verifyProof(
            verifierId,
            proof,
            publicInputs,
            msg.sender,
            proofHash
        );
        if (!valid) revert ArcPass__VerificationFailed(msg.sender, ZK_ATTRIBUTE_PROOF_SCHEMA);

        // Issue Layer 2: ZK Attribute Proof attestation
        bytes32 dataCommitment = keccak256(
            abi.encode(proofHash, attributeHash, block.timestamp)
        );

        claimId = attestationRegistry.attest(
            msg.sender,
            ZK_ATTRIBUTE_PROOF_SCHEMA,
            dataCommitment,
            expiresAt
        );

        emit ProofAccepted(
            msg.sender,
            verifierId,
            proofHash,
            claimId,
            "attribute",
            block.timestamp
        );
    }
}
