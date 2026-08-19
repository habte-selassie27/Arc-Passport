/**
 * ScorersPage — View and manage custom scorers in Studio.
 *
 * Allows issuers to:
 * 1. View registered scorers (from ScorerRegistry)
 * 2. Register a new custom scorer with weight configurator
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { AddressDisplay } from "../../components/ui/AddressDisplay";
import { apiUrl } from "../../config/api";
import { signedFetch } from "../../utils/signedApi";

interface ScorerConfig {
  scorerId: number;
  owner: string;
  name: string;
  threshold: number;
  active: boolean;
}

interface ScorerListResponse {
  count: number;
  scorers: ScorerConfig[];
}

export function ScorersPage() {
  const queryClient = useQueryClient();
  const [showNewForm, setShowNewForm] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<ScorerListResponse>({
    queryKey: ["scorers"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/score/scorers"));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to load scorers");
      return json.data;
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Score Layer"
        title="Custom Scorers"
        description="Register custom scorer configurations for your dApp. Scorers define how attestation weights combine into a trust score."
      />

      <div className="flex justify-between items-center" style={{ marginBottom: "var(--space-4)" }}>
        <span className="t-sm c-subtle">
          {data ? `${data.scorers.length} scorer${data.scorers.length !== 1 ? "s" : ""}` : ""}
        </span>
        <Button onClick={() => setShowNewForm(!showNewForm)}>
          {showNewForm ? "Cancel" : "+ New scorer"}
        </Button>
      </div>

      {isLoading && (
        <Card>
          <Spinner size={20} style={{ margin: "0 auto", display: "block" }} />
        </Card>
      )}

      {error && (
        <ErrorBanner onRetry={() => void refetch()}>
          {(error as Error).message}
        </ErrorBanner>
      )}

      {showNewForm && <RegisterScorerForm onDone={() => { setShowNewForm(false); void queryClient.invalidateQueries({ queryKey: ["scorers"] }); }} />}

      {!isLoading && !error && data && data.scorers.length === 0 && (
        <EmptyState
          title="No scorers registered"
          body="Register a custom scorer to define how attestation weights combine into a trust score for your dApp."
        />
      )}

      {!isLoading && !error && data && data.scorers.length > 0 && (
        <div className="grid gap-3">
          {data.scorers.map((scorer) => (
            <ScorerCard key={scorer.scorerId} scorer={scorer} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScorerCard({ scorer }: { scorer: ScorerConfig }) {
  return (
    <Card>
      <div className="flex justify-between items-start">
        <div>
          <p className="t-sm" style={{ fontWeight: 600 }}>{scorer.name}</p>
          <div className="flex items-center gap-2" style={{ marginTop: "var(--space-1)" }}>
            <span className="mono t-xs c-subtle">ID: {scorer.scorerId}</span>
            <span className="t-xs c-subtle">·</span>
            <span className="t-xs c-subtle">Threshold: {(scorer.threshold / 10).toFixed(1)}</span>
          </div>
        </div>
        <span
          className="chip"
          style={{
            background: scorer.active ? "rgba(0,229,160,0.15)" : "rgba(239,68,68,0.15)",
            color: scorer.active ? "var(--color-verified)" : "var(--color-danger)",
            fontSize: "0.65rem",
          }}
        >
          {scorer.active ? "ACTIVE" : "INACTIVE"}
        </span>
      </div>
      <div style={{ marginTop: "var(--space-2)" }}>
        <span className="t-xs c-subtle">Owner: </span>
        <AddressDisplay address={scorer.owner} />
      </div>
    </Card>
  );
}

function RegisterScorerForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [threshold, setThreshold] = useState("200");
  const [schemaWeights, setSchemaWeights] = useState<Array<{ schemaId: string; weight: number }>>([
    { schemaId: "", weight: 50 },
  ]);
  const [requiredSchemas, setRequiredSchemas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Connect a wallet first");
      const body = {
        name,
        threshold: parseInt(threshold, 10),
        schemaWeights: schemaWeights.filter((w) => w.schemaId.trim()),
        requireAll: requiredSchemas.filter(Boolean),
      };
      return signedFetch({
        path: "/score/scorers",
        address,
        signMessage: signMessageAsync,
        method: "POST",
        body,
      });
    },
    onSuccess: () => onDone(),
    onError: (err) => setError((err as Error).message),
  });

  const addWeight = () => setSchemaWeights([...schemaWeights, { schemaId: "", weight: 50 }]);
  const updateWeight = (i: number, field: "schemaId" | "weight", value: string | number) => {
    const next = [...schemaWeights];
    next[i] = { ...next[i], [field]: value };
    setSchemaWeights(next);
  };
  const removeWeight = (i: number) => setSchemaWeights(schemaWeights.filter((_, idx) => idx !== i));

  return (
    <Card style={{ marginBottom: "var(--space-4)" }}>
      <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>New Scorer</p>
      <div className="grid gap-4">
        <div>
          <label className="t-sm c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>
            Name
          </label>
          <Input
            placeholder="e.g. MyDAO Governance Scorer"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="t-sm c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>
            Threshold (0–1000 raw, display = raw / 10)
          </label>
          <Input
            type="number"
            placeholder="200 (= 20.0 display)"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            style={{ maxWidth: 200 }}
          />
        </div>

        <div>
          <label className="t-sm c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>
            Schema Weights
          </label>
          {schemaWeights.map((w, i) => (
            <div key={i} className="flex gap-2" style={{ marginBottom: "var(--space-2)" }}>
              <Input
                mono
                placeholder="0x... schemaId"
                value={w.schemaId}
                onChange={(e) => updateWeight(i, "schemaId", e.target.value)}
                style={{ flex: 1 }}
              />
              <Input
                type="number"
                placeholder="Weight"
                value={w.weight}
                onChange={(e) => updateWeight(i, "weight", parseInt(e.target.value, 10) || 0)}
                style={{ width: 80 }}
              />
              {schemaWeights.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeWeight(i)}>✕</Button>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addWeight}>+ Add schema weight</Button>
        </div>

        <div>
          <label className="t-sm c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>
            Required schemas (must all be present regardless of score)
          </label>
          <Input
            mono
            placeholder="0x... comma-separated schemaIds"
            value={requiredSchemas.join(", ")}
            onChange={(e) => setRequiredSchemas(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
          />
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <div className="flex gap-2">
          <Button
            onClick={() => void registerMutation.mutate()}
            disabled={!name.trim() || registerMutation.isPending}
          >
            {registerMutation.isPending ? "Registering..." : "Register on-chain"}
          </Button>
          <Button variant="ghost" onClick={onDone}>Cancel</Button>
        </div>
      </div>
    </Card>
  );
}
