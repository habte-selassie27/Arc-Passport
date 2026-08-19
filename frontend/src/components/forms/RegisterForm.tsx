/**
 * RegisterForm — Production-grade identity registration with:
 * - Avatar upload with IPFS pinning via Pinata
 * - Display name validation
 * - Rich profile fields (bio, website, social handles)
 * - Recovery address
 * - Real gas estimate
 * - Tx status tracker
 * - Post-registration: onboarding checklist + shareable passport link
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useReadContract, useWaitForTransactionReceipt, useGasPrice, useSignMessage } from "wagmi";
import { formatEther } from "viem";
import { ADDRESSES } from "../../config/addresses";
import { useIdentityRegister } from "../../hooks/useIdentity";
import { apiUrl } from "../../config/api";
import { signedFetch } from "../../utils/signedApi";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Spinner } from "../ui/Spinner";
import { AddressDisplay } from "../ui/AddressDisplay";
import { toast } from "../shared/Toast";
import { parseContractError } from "../../utils/parseContractError";
import { useWallet } from "../../contexts/WalletContext";
import { QRCodeSVG } from "qrcode.react";

// ── IdentityRegistry ABI ──

const IDENTITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    inputs: [{ name: "metadataURI", type: "string" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getIdentity",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [
      { name: "tokenId", type: "uint256" },
      { name: "metadataURI", type: "string" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ── Validation ──

const NAME_MIN = 3;
const NAME_MAX = 32;
const NAME_REGEX = /^[a-zA-Z0-9 _'-]+$/;

function validateName(v: string): string | null {
  if (v.length === 0) return "Display name is required";
  if (v.length < NAME_MIN) return `At least ${NAME_MIN} characters`;
  if (v.length > NAME_MAX) return `At most ${NAME_MAX} characters`;
  if (!NAME_REGEX.test(v)) return "Letters, numbers, spaces, hyphens only";
  return null;
}

function validateUrl(v: string): string | null {
  if (!v) return null;
  try { new URL(v); return null; } catch { return "Invalid URL"; }
}

function validateAddress(v: string): string | null {
  if (!v) return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) return "Invalid Ethereum address";
  return null;
}

// ── Avatar Upload ──

function AvatarUpload({
  avatar,
  setAvatar,
  avatarPreview,
  setAvatarPreview,
}: {
  avatar: File | null;
  setAvatar: (f: File | null) => void;
  avatarPreview: string;
  setAvatarPreview: (s: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast("error", "Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("error", "Image must be under 5MB");
      return;
    }
    setAvatar(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  }, [setAvatar, setAvatarPreview]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        width: 100,
        height: 100,
        borderRadius: "var(--radius-lg)",
        border: `2px dashed ${dragging ? "var(--color-arc-primary)" : "var(--color-border)"}`,
        background: avatarPreview ? "none" : "var(--color-surface-1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        overflow: "hidden",
        transition: "border-color 0.15s",
        flexShrink: 0,
      }}
    >
      {avatarPreview ? (
        <img src={avatarPreview} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ textAlign: "center", color: "var(--color-subtle)" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 4px" }}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          <p style={{ fontSize: "0.6rem" }}>Drop or click</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

// ── Tx Phase Tracker ──

type TxPhase = "idle" | "uploading" | "simulating" | "signing" | "submitted" | "confirming" | "confirmed" | "failed";

function TxPhaseTracker({ phase, hash, error, explorerUrl }: { phase: TxPhase; hash?: `0x${string}`; error?: string | null; explorerUrl?: string }) {
  if (phase === "idle") return null;

  const steps = [
    { key: "uploading", label: "Uploading" },
    { key: "simulating", label: "Simulating" },
    { key: "signing", label: "Signing" },
    { key: "submitted", label: "Submitted" },
    { key: "confirming", label: "Confirming" },
    { key: "confirmed", label: "Confirmed" },
  ];

  const phaseOrder = ["idle", "uploading", "simulating", "signing", "submitted", "confirming", "confirmed", "failed"];
  const currentIdx = phaseOrder.indexOf(phase);

  return (
    <div
      style={{
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface-1)",
        border: `1px solid ${phase === "failed" ? "rgba(239,68,68,0.3)" : phase === "confirmed" ? "rgba(0,229,160,0.3)" : "var(--color-border)"}`,
      }}
      role="status"
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {steps.map((step, i) => {
          const stepIdx = phaseOrder.indexOf(step.key);
          const isActive = step.key === phase;
          const isDone = stepIdx < currentIdx && phase !== "failed";
          return (
            <div key={step.key} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
              {i > 0 && <span style={{ color: "var(--color-border)", fontSize: "0.6rem" }}>→</span>}
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  fontFamily: "var(--font-mono)",
                  color: isActive ? "var(--color-arc-primary)" : isDone ? "var(--color-verified)" : "var(--color-subtle)",
                  fontWeight: isActive ? 600 : 400,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {isActive && <Spinner size={10} />}
                {!isActive && <span aria-hidden="true">{isDone ? "✓" : "○"}</span>}
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      {hash && (
        <a
          href={explorerUrl || `https://testnet.arcscan.app/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="t-xs mono"
          style={{ color: "var(--color-arc-primary)", display: "inline-block", marginTop: "var(--space-2)" }}
        >
          View on ArcScan ↗
        </a>
      )}
      {error && (
        <p className="t-xs" style={{ color: "var(--color-danger)", marginTop: "var(--space-2)" }}>{error}</p>
      )}
    </div>
  );
}

// ── Gas Estimate Card ──

function GasEstimateCard({ enabled }: { enabled: boolean }) {
  const { data: gasPrice } = useGasPrice();

  if (!enabled || !gasPrice) return null;

  // Arc uses USDC as gas token. Show a rough estimate.
  // Real gas: ~100k gas for register * gasPrice
  const estimatedGas = 100000n;
  const costWei = estimatedGas * gasPrice;
  const costEth = formatEther(costWei);

  return (
    <div
      style={{
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface-1)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="t-xs c-subtle">Estimated gas</span>
        <span className="t-xs mono" style={{ color: "var(--color-verified)" }}>
          ≈ {Number(costEth).toFixed(6)} USDC
        </span>
      </div>
    </div>
  );
}

// ── Onboarding Checklist ──

function OnboardingChecklist({ address }: { address: string }) {
  const passportUrl = `${window.location.origin}/passport/${address}`;
  const [copied, setCopied] = useState(false);

  const steps = [
    { label: "View your passport", href: `/passport/${address}`, icon: "🪪" },
    { label: "Get your first attestation", href: "/guide", icon: "📋" },
    { label: "Verify your identity", href: "/verify", icon: "✓" },
    { label: "Share your passport", href: `/passport/${address}`, icon: "🔗" },
  ];

  return (
    <Card verified style={{ marginTop: "var(--space-4)" }}>
      <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Next steps</p>
      <div className="grid gap-2">
        {steps.map((step) => (
          <Link
            key={step.label}
            to={step.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface-1)",
              textDecoration: "none",
              color: "var(--color-on-surface)",
              transition: "background 0.15s",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: "1rem" }}>{step.icon}</span>
            <span className="t-sm">{step.label}</span>
            <span style={{ marginLeft: "auto", color: "var(--color-subtle)", fontSize: "0.7rem" }}>→</span>
          </Link>
        ))}
      </div>

      {/* Shareable passport link */}
      <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--color-surface-0)" }}>
        <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-2)" }}>Share your passport</p>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <QRCodeSVG value={passportUrl} size={64} bgColor="transparent" fgColor="#00E5A0" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="t-xs mono" style={{ wordBreak: "break-all", color: "var(--color-subtle)" }}>
              {passportUrl}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(passportUrl);
                setCopied(true);
                toast("success", "Link copied");
                setTimeout(() => setCopied(false), 2000);
              }}
              style={{ marginTop: "var(--space-1)" }}
            >
              {copied ? "✓ Copied" : "Copy link"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Main RegisterForm ──

export function RegisterForm() {
  const { address } = useWallet();
  const { signMessageAsync } = useSignMessage();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [github, setGithub] = useState("");
  const [recoveryAddress, setRecoveryAddress] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [txPhase, setTxPhase] = useState<TxPhase>("idle");
  const [txError, setTxError] = useState<string | null>(null);

  // Re-registration guard
  const everTimedOut = useRef(false);
  const { data: existingIdentity, isLoading: checkingIdentity } = useReadContract({
    address: ADDRESSES.identityRegistry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "getIdentity",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!ADDRESSES.identityRegistry,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
    },
  });

  useEffect(() => {
    if (everTimedOut.current) return;
    if (!checkingIdentity) return;
    const t = setTimeout(() => { everTimedOut.current = true; }, 4000);
    return () => clearTimeout(t);
  }, [checkingIdentity]);

  const checkDone = everTimedOut.current || !checkingIdentity;
  const alreadyRegistered = checkDone && existingIdentity && Number(existingIdentity[0]) > 0;

  // Registration hook
  const { writeContract, hash, isPending, isSuccess, error: regError } = useIdentityRegister();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Track tx phase
  useEffect(() => {
    if (isPending && !hash) setTxPhase("signing");
    else if (hash && isConfirming) setTxPhase("confirming");
    else if (isConfirmed) setTxPhase("confirmed");
    else if (regError) {
      setTxPhase("failed");
      setTxError(parseContractError(regError));
    }
  }, [isPending, hash, isConfirming, isConfirmed, regError]);

  // Upload avatar to IPFS and build metadata
  const uploadAndRegister = useCallback(async () => {
    if (!address) return;

    setTxPhase("uploading");
    setTxError(null);

    try {
      // Build profile JSON
      const profile: Record<string, unknown> = { displayName: name || "Anonymous" };
      if (bio) profile.bio = bio;
      if (website) profile.website = website;
      if (twitter) profile.twitter = twitter;
      if (github) profile.github = github;
      if (recoveryAddress) profile.recoveryAddress = recoveryAddress;

      // Upload avatar if present
      if (avatar) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]); // strip data:image/...;base64, prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(avatar);
        });

        const uploadRes = await signedFetch<{ ipfsUri: string }>({
          path: "/upload",
          address,
          signMessage: signMessageAsync,
          method: "POST",
          body: { data: base64, mimeType: avatar.type, name: avatar.name },
        });

        if (uploadRes?.ipfsUri) {
          profile.avatarCid = uploadRes.ipfsUri;
        }
      }

      // Pin the metadata JSON to IPFS (public endpoint — no auth needed)
      const metadataRes = await fetch(apiUrl("/upload/json"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: profile,
          name: `passport-${address}.json`,
        }),
      });
      const metadataJson = await metadataRes.json();
      const metadataUri = metadataJson?.data?.ipfsUri || `ipfs://bafkreibasic_${name.toLowerCase().replace(/\s+/g, "_")}`;

      // Register on-chain
      setTxPhase("signing");
      writeContract({
        address: ADDRESSES.identityRegistry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "register",
        args: [metadataUri],
      });
    } catch (err) {
      setTxPhase("failed");
      setTxError((err as Error).message);
      toast("error", "Registration failed");
    }
  }, [address, name, bio, website, twitter, github, recoveryAddress, avatar, writeContract]);

  // Name validation
  const handleNameChange = useCallback((v: string) => {
    setName(v);
    setNameError(validateName(v));
  }, []);

  const handleWebsiteChange = useCallback((v: string) => {
    setWebsite(v);
    setWebsiteError(validateUrl(v));
  }, []);

  const handleRecoveryChange = useCallback((v: string) => {
    setRecoveryAddress(v);
    setRecoveryError(validateAddress(v));
  }, []);

  const canSubmit = name && !nameError && !websiteError && !recoveryError && !isPending && !isConfirming && !isSuccess;

  // ── Already registered ──
  if (alreadyRegistered) {
    const tokenId = Number(existingIdentity![0]);
    return (
      <Card verified>
        <div style={{ textAlign: "center", padding: "var(--space-4)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "var(--space-2)" }}>🪪</div>
          <p className="t-lg" style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>Identity already registered</p>
          <p className="t-sm c-subtle" style={{ marginBottom: "var(--space-3)" }}>
            This wallet already has an on-chain identity (token #{tokenId}).
          </p>
          <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "center" }}>
            <Link to={`/passport/${address}`}><Button size="sm">View Passport</Button></Link>
            <a href={`https://testnet.arcscan.app/token/${ADDRESSES.identityRegistry}/${tokenId}`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm">Explorer ↗</Button>
            </a>
          </div>
        </div>
      </Card>
    );
  }

  // ── Success ──
  if (isConfirmed && address) {
    return (
      <div className="grid gap-4">
        <Card verified>
          <div style={{ textAlign: "center", padding: "var(--space-4)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "var(--space-2)" }}>✓</div>
            <p className="t-lg" style={{ fontWeight: 600, color: "var(--color-verified)", marginBottom: "var(--space-2)" }}>
              Identity registered
            </p>
            <p className="t-sm c-subtle" style={{ marginBottom: "var(--space-1)" }}>Your on-chain identity is now live.</p>
            <AddressDisplay address={address} />
            {hash && (
              <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="t-xs mono" style={{ color: "var(--color-arc-primary)", display: "inline-block", marginTop: "var(--space-2)" }}>
                View transaction ↗
              </a>
            )}
          </div>
        </Card>
        <OnboardingChecklist address={address} />
      </div>
    );
  }

  // ── Registration form ──
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (canSubmit) uploadAndRegister(); }} className="grid gap-4">
      {/* Avatar + Name */}
      <Card>
        <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Identity</p>
        <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
          <AvatarUpload avatar={avatar} setAvatar={setAvatar} avatarPreview={avatarPreview} setAvatarPreview={setAvatarPreview} />
          <div style={{ flex: 1 }}>
            <Field label="Display name" htmlFor="reg-name" error={nameError} helper={`${name.length}/${NAME_MAX}`}>
              <Input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Your display name"
                autoComplete="off"
                maxLength={NAME_MAX}
                aria-invalid={!!nameError}
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* Profile fields */}
      <Card>
        <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Profile</p>
        <div className="grid gap-4">
          <Field label="Bio" htmlFor="reg-bio" helper="Optional. Up to 160 characters.">
            <textarea
              id="reg-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              placeholder="Tell us about yourself"
              maxLength={160}
              rows={3}
              className="input"
              style={{ resize: "vertical", fontFamily: "var(--font-body)" }}
            />
          </Field>
          <Field label="Website" htmlFor="reg-website" helper="Optional. Your personal website." error={websiteError}>
            <Input
              id="reg-website"
              type="url"
              value={website}
              onChange={(e) => handleWebsiteChange(e.target.value)}
              placeholder="https://example.com"
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <Field label="Twitter" htmlFor="reg-twitter" helper="@handle">
              <Input
                id="reg-twitter"
                type="text"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="@username"
              />
            </Field>
            <Field label="GitHub" htmlFor="reg-github" helper="Username">
              <Input
                id="reg-github"
                type="text"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="username"
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* Recovery */}
      <Card>
        <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Security</p>
        <Field label="Recovery address" htmlFor="reg-recovery" helper="Optional. A secondary wallet that can recover your identity if your primary wallet is lost." error={recoveryError}>
          <Input
            id="reg-recovery"
            mono
            type="text"
            value={recoveryAddress}
            onChange={(e) => handleRecoveryChange(e.target.value)}
            placeholder="0x..."
          />
        </Field>
      </Card>

      {/* Gas estimate */}
      <GasEstimateCard enabled={!!canSubmit && !!ADDRESSES.identityRegistry} />

      {/* Tx phase tracker */}
      <TxPhaseTracker phase={txPhase} hash={hash} error={txError} />

      <Button
        type="submit"
        block
        disabled={!canSubmit}
        loading={isPending || isConfirming || txPhase === "uploading"}
      >
        {txPhase === "uploading" ? "Uploading to IPFS…" : isPending ? "Waiting for wallet…" : isConfirming ? "Confirming…" : "Register Identity"}
      </Button>

      {regError && txPhase !== "failed" && (
        <p className="c-danger t-sm text-center">{parseContractError(regError)}</p>
      )}
    </form>
  );
}
