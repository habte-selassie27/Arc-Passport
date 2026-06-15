// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Defines the shape of an attestation claim (field names, types, version).
/// @dev Schemas are immutable once registered. A new version requires registering a new schema.
struct Schema {
    bytes32 schemaId;
    string  name;
    string  version;
    string  fieldsJson;
    address registrant;
    uint256 registeredAt;
}

/// @title ISchemaRegistry
/// @notice Stores claim schema definitions. Schemas are identified by a deterministic bytes32
///         schemaId = keccak256(abi.encodePacked(name, version, fieldsJson)).
interface ISchemaRegistry {
    event SchemaRegistered(bytes32 indexed schemaId, address indexed registrant, string name, string version);

    /// @notice Register a new claim schema. Schemas are immutable once registered.
    /// @param  name        Human-readable schema name (e.g. "kyc_basic").
    /// @param  version     Semantic version string (e.g. "1.0").
    /// @param  fieldsJson  JSON-encoded field definitions.
    /// @return schemaId    Deterministic identifier for the schema.
    function registerSchema(
        string calldata name,
        string calldata version,
        string calldata fieldsJson
    ) external returns (bytes32 schemaId);

    /// @notice Get the full Schema struct for a given schemaId.
    function getSchema(bytes32 schemaId) external view returns (Schema memory);

    /// @notice Check whether a schemaId has been registered.
    function isRegistered(bytes32 schemaId) external view returns (bool);

    /// @notice Get the total number of registered schemas.
    function getSchemaCount() external view returns (uint256);

    /// @notice Get a paginated list of all registered schema IDs.
    /// @param  offset  Starting index.
    /// @param  limit   Maximum number of IDs to return.
    function getSchemas(uint256 offset, uint256 limit) external view returns (bytes32[] memory);
}
