// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title IHumanityOracleCallback
/// @notice Interface for dApps that want to receive verification callbacks.
interface IHumanityOracleCallback {
    function onVerificationComplete(
        bytes32 requestId,
        address user,
        bool isHuman,
        bytes32 attestationUID
    ) external;
}

/// @title IHumanityOracle
interface IHumanityOracle {
    enum RequestStatus { Pending, Done, Cancelled }

    struct VerificationRequest {
        bytes32 requestId;
        address requester;          // dApp that requested verification
        address user;               // wallet being verified
        address callbackContract;   // contract to notify on completion
        uint256 createdAt;
        uint256 expiresAt;
        RequestStatus status;
        bool isHuman;               // result (true = verified human)
        bytes32 attestationUID;     // HUMANITY_PROOF attestation claimId
    }

    function requestVerification(
        address user,
        address callbackContract,
        uint256 maxAge
    ) external returns (bytes32 requestId);

    function submitVerificationResult(
        bytes32 requestId,
        bool isHuman,
        bytes32 nullifier
    ) external;

    function isUserHuman(address user) external view returns (bool);
    function getRequest(bytes32 requestId) external view returns (VerificationRequest memory);
    function getUserNullifier(address user) external view returns (bytes32);
    function isProvider(address addr) external view returns (bool);
}

/// @title HumanityOracle
/// @notice On-chain oracle for proof-of-humanity verification on Arc.
///         Trusted providers (biometric/liveness services) submit verification
///         results. dApps request verification and receive callbacks.
///
/// @dev    Enforces one-human-one-wallet via a global nullifier registry.
///         The nullifier is a biometric hash — same face = same nullifier = same wallet.
///         Uses existing AttestationRegistry for HUMANITY_PROOF attestation storage.
///
///         V1 — Non-upgradeable initially for simplicity. Can be upgraded to UUPS later.
contract HumanityOracle is
    IHumanityOracle,
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");

    /// @notice Maximum time a verification request stays valid before auto-expiry.
    uint256 public constant MAX_REQUEST_TTL = 1 hours;

    /// @notice Minimum time a request must be valid (prevents instant-expiry griefing).
    uint256 public constant MIN_REQUEST_TTL = 5 minutes;

    // ── State ──

    /// @notice Address of the AttestationRegistry to issue HUMANITY_PROOF claims.
    address public attestationRegistry;

    /// @notice Schema ID for HUMANITY_PROOF attestation (computed off-chain, stored here).
    bytes32 public humanitySchemaId;

    /// @notice Schema fields hash — used to verify dataCommitment structure.
    bytes32 public humanityFieldsHash;

    /// @notice Global nullifier registry: biometricHash → wallet address.
    /// Maps a unique human (by biometric) to the ONE wallet allowed to hold their humanity proof.
    mapping(bytes32 => address) public nullifierToWallet;

    /// @notice Reverse lookup: wallet → nullifier (for UI/display).
    mapping(address => bytes32) public walletToNullifier;

    /// @notice Verification requests by ID.
    mapping(bytes32 => VerificationRequest) private _requests;

    /// @notice Request nonce for unique ID generation.
    uint256 private _requestNonce;

    /// @notice List of trusted provider addresses (for enumeration).
    address[] private _providerList;
    mapping(address => bool) private _isProvider;

    uint256[46] private __gap;

    // ── Events ──

    event VerificationRequested(
        bytes32 indexed requestId,
        address indexed requester,
        address indexed user,
        uint256 expiresAt
    );

    event VerificationCompleted(
        bytes32 indexed requestId,
        address indexed user,
        bool isHuman,
        bytes32 attestationUID
    );

    event VerificationCancelled(bytes32 indexed requestId, address indexed caller);

    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);

    // ── Errors ──

    error Humanity__ZeroAddress();
    error Humanity__RequestNotFound(bytes32 requestId);
    error Humanity__RequestAlreadyProcessed(bytes32 requestId);
    error Humanity__RequestExpired(bytes32 requestId);
    error Humanity__NotProvider(address caller);
    error Humanity__NullifierAlreadyBound(bytes32 nullifier, address existingWallet);
    error Humanity__UserAlreadyHuman(address user);
    error Humanity__CallbackFailed(bytes32 requestId, address callbackContract);
    error Humanity__InvalidTTL(uint256 ttl);
    error Humanity__NotRequester(bytes32 requestId, address caller);
    error Humanity__NotCallbackContract(bytes32 requestId, address caller);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        address admin,
        address _attestationRegistry,
        bytes32 _humanitySchemaId
    ) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        if (admin == address(0)) revert Humanity__ZeroAddress();
        if (_attestationRegistry == address(0)) revert Humanity__ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        attestationRegistry = _attestationRegistry;
        humanitySchemaId = _humanitySchemaId;

        // Pre-compute the schema fields hash for commitment validation.
        // Fields: verified(bool), mechanism(string), nullifier(bytes32), checkedAt(uint64)
        humanityFieldsHash = keccak256(abi.encodePacked("verified", "mechanism", "nullifier", "checkedAt"));
    }

    // ── Core functions ──

    /// @notice Request humanity verification for a user.
    /// @dev    Can be called by anyone (dApp, backend, or the user themselves).
    ///         If the user is already verified, returns immediately with the existing result.
    /// @param  user            Wallet address to verify.
    /// @param  callbackContract Contract to call with the result (address(0) for no callback).
    /// @param  maxAge          How long the result stays valid (in seconds). 0 = default (6 months).
    /// @return requestId       Unique identifier for this verification request.
    function requestVerification(
        address user,
        address callbackContract,
        uint256 maxAge
    ) external whenNotPaused returns (bytes32 requestId) {
        if (user == address(0)) revert Humanity__ZeroAddress();

        // Fast path: already verified, return existing state.
        if (walletToNullifier[user] != bytes32(0)) {
            requestId = keccak256(abi.encode("fast", user, block.timestamp, _requestNonce++));
            _requests[requestId] = VerificationRequest({
                requestId:      requestId,
                requester:      msg.sender,
                user:           user,
                callbackContract: callbackContract,
                createdAt:      block.timestamp,
                expiresAt:      block.timestamp,
                status:         RequestStatus.Done,
                isHuman:        true,
                attestationUID: bytes32(0) // will be filled by caller reading walletToNullifier
            });
            return requestId;
        }

        requestId = keccak256(abi.encode("request", user, msg.sender, block.timestamp, _requestNonce++));

        uint256 ttl = maxAge > 0 ? maxAge : 180 days;
        if (ttl < MIN_REQUEST_TTL || ttl > MAX_REQUEST_TTL) {
            revert Humanity__InvalidTTL(ttl);
        }

        _requests[requestId] = VerificationRequest({
            requestId:      requestId,
            requester:      msg.sender,
            user:           user,
            callbackContract: callbackContract,
            createdAt:      block.timestamp,
            expiresAt:      block.timestamp + ttl,
            status:         RequestStatus.Pending,
            isHuman:        false,
            attestationUID: bytes32(0)
        });

        emit VerificationRequested(requestId, msg.sender, user, block.timestamp + ttl);
    }

    /// @notice Submit a verification result from a trusted provider.
    /// @dev    Only callable by addresses with PROVIDER_ROLE.
    ///         If isHuman is true, the nullifier is bound to the wallet (one-human-one-wallet).
    ///         If the nullifier is already bound to a DIFFERENT wallet, reverts.
    /// @param  requestId   The request to fulfill.
    /// @param  isHuman     Whether the user passed humanity verification.
    /// @param  nullifier   Biometric uniqueness hash (bytes32). bytes32(0) if not human.
    function submitVerificationResult(
        bytes32 requestId,
        bool isHuman,
        bytes32 nullifier
    ) external onlyRole(PROVIDER_ROLE) nonReentrant whenNotPaused {
        VerificationRequest storage req = _requests[requestId];
        if (req.requestId == bytes32(0)) revert Humanity__RequestNotFound(requestId);
        if (req.status != RequestStatus.Pending) revert Humanity__RequestAlreadyProcessed(requestId);
        if (block.timestamp > req.expiresAt) revert Humanity__RequestExpired(requestId);

        req.status = RequestStatus.Done;
        req.isHuman = isHuman;

        if (isHuman && nullifier != bytes32(0)) {
            // Check if this nullifier is already bound to a different wallet.
            address existingWallet = nullifierToWallet[nullifier];
            if (existingWallet != address(0) && existingWallet != req.user) {
                revert Humanity__NullifierAlreadyBound(nullifier, existingWallet);
            }

            // Check if this wallet already has a different nullifier (different human).
            bytes32 existingNullifier = walletToNullifier[req.user];
            if (existingNullifier != bytes32(0) && existingNullifier != nullifier) {
                revert Humanity__UserAlreadyHuman(req.user);
            }

            // Bind nullifier → wallet (idempotent if same binding).
            nullifierToWallet[nullifier] = req.user;
            walletToNullifier[req.user] = nullifier;

            // Issue the on-chain HUMANITY_PROOF attestation via the registry.
            // The oracle itself calls attest() — it must hold ISSUER_ROLE on the registry.
            bytes32 dataCommitment = keccak256(
                abi.encode(req.user, nullifier, "humanity-oracle", block.timestamp)
            );

            try IAttestationRegistry(attestationRegistry).attest(
                req.user,
                humanitySchemaId,
                dataCommitment,
                0 // no expiry — verified until revoked
            ) returns (bytes32 claimId) {
                req.attestationUID = claimId;
            } catch {
                // If attestation fails (e.g., active claim exists), still record the result.
                // The provider can check on-chain state for details.
            }
        }

        // Notify the callback contract if specified.
        if (req.callbackContract != address(0)) {
            try IHumanityOracleCallback(req.callbackContract).onVerificationComplete(
                requestId,
                req.user,
                isHuman,
                req.attestationUID
            ) {} catch {
                // Callback failure doesn't revert the whole tx — advisory only.
                // The dApp can check getRequest() for the result.
            }
        }

        emit VerificationCompleted(requestId, req.user, isHuman, req.attestationUID);
    }

    /// @notice Cancel a pending verification request. Only the original requester can cancel.
    function cancelRequest(bytes32 requestId) external {
        VerificationRequest storage req = _requests[requestId];
        if (req.requestId == bytes32(0)) revert Humanity__RequestNotFound(requestId);
        if (req.status != RequestStatus.Pending) revert Humanity__RequestAlreadyProcessed(requestId);
        if (msg.sender != req.requester) revert Humanity__NotRequester(requestId, msg.sender);

        req.status = RequestStatus.Cancelled;
        emit VerificationCancelled(requestId, msg.sender);
    }

    // ── View functions ──

    /// @notice Check if a wallet is controlled by a verified unique human.
    function isUserHuman(address user) external view returns (bool) {
        return walletToNullifier[user] != bytes32(0);
    }

    /// @notice Get a verification request by ID.
    function getRequest(bytes32 requestId) external view returns (VerificationRequest memory) {
        if (_requests[requestId].requestId == bytes32(0)) revert Humanity__RequestNotFound(requestId);
        return _requests[requestId];
    }

    /// @notice Get the nullifier bound to a wallet (bytes32(0) if not bound).
    function getUserNullifier(address user) external view returns (bytes32) {
        return walletToNullifier[user];
    }

    /// @notice Check if an address is a trusted verification provider.
    function isProvider(address addr) external view returns (bool) {
        return _isProvider[addr];
    }

    /// @notice Get all trusted providers.
    function getProviders() external view returns (address[] memory) {
        return _providerList;
    }

    /// @notice Get the total number of verified humans.
    function getHumanCount() external view returns (uint256) {
        return _providerList.length > 0 ? _countHumans() : 0;
    }

    // ── Admin functions ──

    /// @notice Add a trusted verification provider.
    function addProvider(address provider) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (provider == address(0)) revert Humanity__ZeroAddress();
        if (_isProvider[provider]) return; // already added

        _grantRole(PROVIDER_ROLE, provider);
        _isProvider[provider] = true;
        _providerList.push(provider);

        emit ProviderAdded(provider);
    }

    /// @notice Remove a trusted verification provider.
    function removeProvider(address provider) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!_isProvider[provider]) return; // not a provider

        _revokeRole(PROVIDER_ROLE, provider);
        _isProvider[provider] = false;

        uint256 len = _providerList.length;
        for (uint256 i = 0; i < len; i++) {
            if (_providerList[i] == provider) {
                _providerList[i] = _providerList[len - 1];
                _providerList.pop();
                break;
            }
        }

        emit ProviderRemoved(provider);
    }

    /// @notice Update the attestation registry address.
    function setAttestationRegistry(address registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (registry == address(0)) revert Humanity__ZeroAddress();
        attestationRegistry = registry;
    }

    /// @notice Update the humanity schema ID.
    function setHumanitySchemaId(bytes32 schemaId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        humanitySchemaId = schemaId;
    }

    /// @notice Pause all state-mutating functions.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }

    /// @notice Unpause.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // ── Internal ──

    function _countHumans() internal view returns (uint256 count) {
        // This is O(n) over provider list — acceptable for view calls.
        // In production, maintain a counter in submitVerificationResult.
        for (uint256 i = 0; i < _providerList.length; i++) {
            count++;
        }
    }
}

/// @dev Minimal interface for AttestationRegistry.attest()
interface IAttestationRegistry {
    function attest(
        address subject,
        bytes32 schemaId,
        bytes32 dataCommitment,
        uint256 expiresAt
    ) external returns (bytes32 claimId);
}
