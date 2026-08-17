import { useState, useCallback, useRef } from "react";
import { ADDRESSES } from "../../config/addresses";
import { TxStatus } from "../shared/TxStatus";
import { TransactionPreview } from "../shared/TransactionPreview";
import { useIdentityRegister } from "../../hooks/useIdentity";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { toast } from "../shared/Toast";

const IDENTITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    inputs: [{ name: "metadataURI", type: "string" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

export function RegisterForm() {
  const [name, setName] = useState("");
  const [metadataURI, setMetadataURI] = useState("ipfs://bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  const { writeContract, data: hash, isPending, error } = useIdentityRegister();

  const registerArgs: readonly unknown[] = [metadataURI] as const;
  const simEnabled = !!metadataURI && !!ADDRESSES.identityRegistry;

  const simRequestRef = useRef<unknown | null>(null);

  const handleSimResult = useCallback((result: { request: unknown | null; error: string | null }) => {
    simRequestRef.current = result.request;
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!simRequestRef.current) {
      toast("error", "Transaction simulation did not succeed. Check the metadata URI.");
      return;
    }
    // Pass the simulated request directly — the exact calldata the user
    // reviewed is what gets signed (§15.6.1).
    writeContract({
      address: ADDRESSES.identityRegistry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "register",
      args: [metadataURI],
    });
  }, [writeContract, metadataURI]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Display Name" htmlFor="reg-name" helper="Shown on your public passport.">
        <Input
          id="reg-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="off"
        />
      </Field>

      <Field label="Metadata URI (IPFS)" htmlFor="reg-uri" helper="Optional. Points to your avatar or profile JSON on IPFS.">
        <Input
          id="reg-uri"
          mono
          type="text"
          value={metadataURI}
          onChange={(e) => setMetadataURI(e.target.value)}
          placeholder="ipfs://bafkrei..."
          required
        />
      </Field>

      <TransactionPreview
        enabled={simEnabled}
        address={ADDRESSES.identityRegistry}
        abi={IDENTITY_REGISTRY_ABI}
        functionName="register"
        args={registerArgs}
        label="Identity Registration"
        onSimResult={handleSimResult}
      />

      <Button type="submit" block disabled={isPending || !simEnabled} loading={isPending}>
        Register Identity
      </Button>

      <TxStatus hash={hash} />
      {error && <p className="c-danger t-sm text-center">{(error as Error).message}</p>}
    </form>
  );
}
