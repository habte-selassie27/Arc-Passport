import { describe, it, expect, vi } from "vitest";

// face-api's node entry needs native TF bindings absent in tests; the pure
// math under test never touches the model, so stub the import.
vi.mock("@vladmandic/face-api", () => ({}));

import { euclidean, matchDescriptors, FACE_MATCH_THRESHOLD } from "../faceMatch";

function vec(...vals: number[]): Float32Array {
  return new Float32Array(vals);
}

describe("euclidean", () => {
  it("returns 0 for identical descriptors", () => {
    expect(euclidean(vec(1, 2, 3), vec(1, 2, 3))).toBe(0);
  });

  it("computes the root sum of squares", () => {
    expect(euclidean(vec(0, 0), vec(3, 4))).toBeCloseTo(5);
  });

  it("throws on length mismatch", () => {
    expect(() => euclidean(vec(1), vec(1, 2))).toThrow();
  });
});

describe("matchDescriptors", () => {
  it("passes when every pair is under the threshold", () => {
    const r = matchDescriptors(
      [
        { name: "id", descriptor: vec(0, 0) },
        { name: "selfie", descriptor: vec(0.1, 0.1) },
        { name: "avatar", descriptor: vec(0.05, -0.05) },
      ],
      0.6
    );
    expect(r.scores).toHaveLength(3);
    expect(r.pass).toBe(true);
  });

  it("fails when any single pair is over the threshold", () => {
    const r = matchDescriptors(
      [
        { name: "id", descriptor: vec(0, 0) },
        { name: "selfie", descriptor: vec(0.1, 0) },
        { name: "avatar", descriptor: vec(5, 5) },
      ],
      0.6
    );
    expect(r.pass).toBe(false);
    expect(r.scores.find((s) => s.pair === "id-avatar")?.pass).toBe(false);
    expect(r.scores.find((s) => s.pair === "id-selfie")?.pass).toBe(true);
  });

  it("fails with no pairs", () => {
    expect(matchDescriptors([{ name: "id", descriptor: vec(0) }]).pass).toBe(false);
  });

  it("exposes the default threshold", () => {
    expect(FACE_MATCH_THRESHOLD).toBe(0.6);
  });
});
