import { keccak256, encodeAbiParameters, parseAbiParameters } from "viem";
import { MerkleTree } from "merkletreejs";

export interface ClaimField {
  name: string;
  type: string;
  value: unknown;
}

export function buildClaimTree(fields: ClaimField[]): {
  root: `0x${string}`;
  leaves: `0x${string}`[];
  tree: MerkleTree;
} {
  const leaves = fields.map((f) =>
    keccak256(
      encodeAbiParameters(parseAbiParameters("string, string, bytes32"), [
        f.name,
        f.type,
        keccak256(encodeAbiParameters(parseAbiParameters(f.type), [f.value as never])),
      ])
    )
  );

  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  return {
    root: `0x${tree.getHexRoot()}` as `0x${string}`,
    leaves: leaves as `0x${string}`[],
    tree,
  };
}

export function getFieldProof(
  tree: MerkleTree,
  leafIndex: number
): `0x${string}`[] {
  return tree.getHexProof(tree.getLeaves()[leafIndex]) as `0x${string}`[];
}
