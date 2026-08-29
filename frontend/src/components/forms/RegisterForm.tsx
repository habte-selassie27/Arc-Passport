/**
 * RegisterForm — Humanity Profile submission with:
 * - Single-person full-face photo with face detection
 * - Strict field validation (name, social handles, bio, wallet)
 * - Country + Timezone selectors (not free-text)
 * - Review screen before final submission
 * - Real gas estimate, tx status tracker
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useReadContract, useWaitForTransactionReceipt, useGasPrice, useEstimateGas } from "wagmi";
import { formatEther, encodeFunctionData } from "viem";
import { ADDRESSES } from "../../config/addresses";
import { IDENTITY_REGISTRY_ABI } from "../../abis/identityRegistry";
import { useIdentityRegister } from "../../hooks/useIdentity";
import { apiUrl } from "../../config/api";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Spinner } from "../ui/Spinner";
import { toast } from "../shared/Toast";
import { parseContractError } from "../../utils/parseContractError";
import { useWallet } from "../../contexts/WalletContext";

// ── Validation ──

const NAME_MIN = 3;
const NAME_MAX = 32;
const NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9 _'.-]+$/;
const BIO_MAX = 280;
const URL_BLOCKLIST = /github\.com|twitter\.com|x\.com|discord\.(gg|com)|t\.me|0x[0-9a-f]{40}/i;
const EMOJI_REGEX = /\p{Emoji_Presentation}/u;
const WALLET_REGEX = /^0x[0-9a-fA-F]{40}$/;
const HANDLE_RE = /^[a-zA-Z0-9._-]{1,38}$/;

function validateName(v: string): string | null {
  if (v.length === 0) return "Official name is required";
  if (v.length < NAME_MIN) return `At least ${NAME_MIN} characters`;
  if (v.length > NAME_MAX) return `At most ${NAME_MAX} characters`;
  if (!NAME_REGEX.test(v)) return "Must start with a letter. Letters, numbers, spaces, hyphens, apostrophes only";
  if (EMOJI_REGEX.test(v)) return "No emojis allowed";
  if (WALLET_REGEX.test(v)) return "Use your real name, not a wallet address";
  if (/^https?:\/\//.test(v)) return "Use your real name, not a URL";
  if (/^@/.test(v)) return "Use your real name, not a username";
  return null;
}

function validateUrl(v: string): string | null {
  if (!v) return null;
  let url: URL;
  try { url = new URL(v); } catch { return "Invalid URL"; }
  if (url.protocol !== "https:") return "Must use https://";
  if (URL_BLOCKLIST.test(v)) return "No social links here — use the dedicated fields";
  return null;
}

function validateAddress(v: string): string | null {
  if (!v) return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) return "Invalid Ethereum address (0x + 40 hex chars)";
  return null;
}

function validateHandle(v: string, platform: string): string | null {
  if (!v) return null;
  if (/^https?:\/\//.test(v)) return `Enter your ${platform} username, not a URL`;
  if (/^@/.test(v)) return `Don't include the @ symbol`;
  if (WALLET_REGEX.test(v)) return `Invalid ${platform} username`;
  if (!HANDLE_RE.test(v)) return `Invalid ${platform} username format`;
  return null;
}

function validateBio(v: string): string | null {
  if (!v) return null;
  if (v.length > BIO_MAX) return `At most ${BIO_MAX} characters`;
  if (WALLET_REGEX.test(v)) return "No wallet addresses in bio";
  if (URL_BLOCKLIST.test(v)) return "No URLs or social links — use the dedicated fields";
  if (EMOJI_REGEX.test(v)) return "No emojis in bio";
  return null;
}

// ── Country & Timezone data ──

const COUNTRIES = [
  "","Afghanistan","Albania","Algeria","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominican Republic","Ecuador","Egypt","El Salvador","Estonia","Ethiopia","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Guatemala","Guinea","Guyana","Haiti","Honduras","Hong Kong","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Liberia","Libya","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Mauritania","Mauritius","Mexico","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saudi Arabia","Senegal","Serbia","Sierra Leone","Singapore","Slovakia","Slovenia","Somalia","South Africa","South Korea","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Togo","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe",
];

const TIMEZONES = [
  "","Pacific/Midway","Pacific/Honolulu","America/Anchorage","America/Los_Angeles","America/Denver","America/Chicago","America/New_York","America/Caracas","America/Halifax","America/St_Johns","America/Sao_Paulo","Atlantic/South_Georgia","Atlantic/Azores","Europe/London","Europe/Paris","Europe/Berlin","Europe/Athens","Europe/Moscow","Asia/Dubai","Asia/Karachi","Asia/Kolkata","Asia/Dhaka","Asia/Bangkok","Asia/Shanghai","Asia/Tokyo","Australia/Sydney","Pacific/Auckland","Pacific/Tongatapu",
];

// ── IPFS upload helpers (with proper error handling) ──

async function uploadFileToIpfs(base64: string, mimeType: string, name: string, opts?: { purpose?: string; wallet?: string }): Promise<string | null> {
  const res = await fetch(apiUrl("/upload/file"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: base64, mimeType, name, ...opts }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[upload/file]", res.status, text);
    return null;
  }
  const json = await res.json().catch(() => null);
  return json?.data?.ipfsUri ?? null;
}

async function uploadJsonToIpfs(data: Record<string, unknown>, name: string): Promise<string | null> {
  const res = await fetch(apiUrl("/upload/json"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, name }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[upload/json]", res.status, text);
    return null;
  }
  const json = await res.json().catch(() => null);
  return json?.data?.ipfsUri ?? null;
}

// ── Photo Validator (face detection) ──

type PhotoStatus = "idle" | "checking" | "valid" | "invalid";

let faceDetectorPromise: Promise<any> | null = null;

async function getFaceDetector() {
  if (!faceDetectorPromise) {
    faceDetectorPromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const { FaceDetector, FilesetResolver } = vision;
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
    })().catch((err) => { faceDetectorPromise = null; throw err; });
  }
  return faceDetectorPromise;
}

// ── Avatar Upload ──

function AvatarUpload({
  avatar,
  setAvatar,
  avatarPreview,
  setAvatarPreview,
  photoStatus,
  setPhotoStatus,
  photoMessage,
  setPhotoMessage,
}: {
  avatar: File | null;
  setAvatar: (f: File | null) => void;
  avatarPreview: string;
  setAvatarPreview: (s: string) => void;
  photoStatus: PhotoStatus;
  setPhotoStatus: (s: PhotoStatus) => void;
  photoMessage: string;
  setPhotoMessage: (s: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const validatePhoto = useCallback(async (file: File) => {
    setPhotoStatus("checking");
    setPhotoMessage("Analyzing photo...");
    try {
      const detector = await getFaceDetector();
      const img = new Image();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      img.src = dataUrl;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });

      const result = detector.detect(img);
      const faces = result.detections ?? [];

      if (faces.length === 0) {
        setPhotoStatus("invalid");
        setPhotoMessage("No face detected. Please use a clear, front-facing photo.");
        setAvatar(null);
        setAvatarPreview("");
        return;
      }
      if (faces.length > 1) {
        setPhotoStatus("invalid");
        setPhotoMessage(`Found ${faces.length} faces. Please use a photo with only one person.`);
        setAvatar(null);
        setAvatarPreview("");
        return;
      }

      // Check face is reasonably centered and large enough
      const face = faces[0];
      const bbox = face.boundingBox;
      const faceArea = bbox.width * bbox.height;
      const imgArea = img.width * img.height;
      const faceRatio = faceArea / imgArea;

      if (faceRatio < 0.02) {
        setPhotoStatus("invalid");
        setPhotoMessage("Face is too small. Please use a closer, front-facing photo.");
        setAvatar(null);
        setAvatarPreview("");
        return;
      }

      setPhotoStatus("valid");
      setPhotoMessage("Single face detected");
      setAvatar(file);
      setAvatarPreview(dataUrl);
    } catch (err) {
      // If face detection fails to load, accept the photo anyway
      console.warn("[AvatarUpload] Face detection unavailable:", err);
      setPhotoStatus("valid");
      setPhotoMessage("Photo uploaded (face detection unavailable)");
      setAvatar(file);
      const reader = new FileReader();
      reader.onload = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, [setAvatar, setAvatarPreview, setPhotoStatus, setPhotoMessage]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast("error", "Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("error", "Image must be under 5MB");
      return;
    }
    validatePhoto(file);
  }, [validatePhoto]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const borderColor = photoStatus === "valid" ? "var(--color-verified)"
    : photoStatus === "invalid" ? "var(--color-danger)"
    : photoStatus === "checking" ? "var(--color-arc-primary)"
    : dragging ? "var(--color-arc-primary)" : "var(--color-border)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          width: 120,
          height: 120,
          borderRadius: "var(--radius-lg)",
          border: `2px dashed ${borderColor}`,
          background: avatarPreview ? "none" : "var(--color-surface-1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          overflow: "hidden",
          transition: "border-color 0.15s",
        }}
      >
        {avatarPreview ? (
          <img src={avatarPreview} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ textAlign: "center", color: "var(--color-subtle)", padding: "var(--space-2)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 4px" }}>
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <p style={{ fontSize: "0.55rem", lineHeight: 1.3 }}>Full face photo</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
      {/* Photo status message */}
      {photoStatus !== "idle" && (
        <p
          className="t-xs"
          style={{
            color: photoStatus === "valid" ? "var(--color-verified)"
              : photoStatus === "invalid" ? "var(--color-danger)"
              : "var(--color-muted)",
            textAlign: "center",
            maxWidth: 130,
            lineHeight: 1.3,
          }}
        >
          {photoStatus === "checking" && <Spinner size={10} style={{ marginRight: 4 }} />}
          {photoMessage}
        </p>
      )}
      {/* Requirements */}
      {!avatar && photoStatus === "idle" && (
        <div style={{ fontSize: "0.6rem", color: "var(--color-subtle)", lineHeight: 1.5, textAlign: "center" }}>
          <p>✓ One person</p>
          <p>✓ Full face visible</p>
          <p>✓ No group photos</p>
        </div>
      )}
    </div>
  );
}

// ── Tx Phase Tracker ──

type TxPhase = "idle" | "uploading" | "signing" | "submitted" | "confirming" | "confirmed" | "activating" | "failed";

function TxPhaseTracker({ phase, hash, error }: { phase: TxPhase; hash?: `0x${string}`; error?: string | null }) {
  if (phase === "idle") return null;

  const steps = [
    { key: "uploading", label: "Uploading" },
    { key: "signing", label: "Signing" },
    { key: "confirming", label: "Confirming" },
    { key: "activating", label: "Activating" },
    { key: "confirmed", label: "Done" },
  ];

  const phaseOrder = ["idle", "uploading", "signing", "submitted", "confirming", "confirmed", "activating", "failed"];
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
          href={`https://testnet.arcscan.app/tx/${hash}`}
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

function GasEstimateCard({ enabled, registryAddress }: { enabled: boolean; registryAddress?: `0x${string}` }) {
  const { data: gasPrice } = useGasPrice();

  // Encode a dummy register() call to get a real gas estimate
  const { data: gasEstimate } = useEstimateGas({
    to: registryAddress,
    data: gasPrice !== undefined
      ? encodeFunctionData({
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "register",
          args: ["ipfs://placeholder"],
        })
      : undefined,
    query: { enabled: enabled && !!gasPrice && !!registryAddress },
  });

  if (!enabled || !gasPrice || !gasEstimate) return null;

  const costWei = gasEstimate * gasPrice;
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
          ≈ {Number(costEth).toFixed(6)} USDC ({gasEstimate.toLocaleString()} units)
        </span>
      </div>
    </div>
  );
}

// ── Onboarding Checklist ──

// ── Main RegisterForm ──

export function RegisterForm() {
  const { address } = useWallet();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [github, setGithub] = useState("");
  const [discord, setDiscord] = useState("");
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState("");
  const [recoveryAddress, setRecoveryAddress] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [twitterError, setTwitterError] = useState<string | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [discordError, setDiscordError] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [photoStatus, setPhotoStatus] = useState<PhotoStatus>("idle");
  const [photoMessage, setPhotoMessage] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [txPhase, setTxPhase] = useState<TxPhase>("idle");
  const [txError, setTxError] = useState<string | null>(null);

  // Single identity check — balanceOf is the reliable duplicate guard
  // (the registry is a plain ERC-721; getIdentity() does not exist on it)
  const everTimedOut = useRef(false);
  const { data: identityBalance, isLoading: checkingIdentity } = useReadContract({
    address: ADDRESSES.identityRegistry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "balanceOf",
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
  const alreadyRegistered = checkDone && identityBalance !== undefined && identityBalance > 0n;

  // Registration hook — exposed states are now accurate
  const { writeContract, hash, isSigning, isConfirming, isSuccess, error: regError } = useIdentityRegister();

  // Track tx phase — single source of truth
  useEffect(() => {
    if (isSigning && !hash) setTxPhase("signing");
    else if (hash && isConfirming) setTxPhase("confirming");
    else if (isSuccess) {
      setTxPhase("confirmed");
      sessionStorage.removeItem("arcpass_register_check_done");
    } else if (regError) {
      setTxPhase("failed");
      setTxError(parseContractError(regError));
    }
  }, [isSigning, hash, isConfirming, isSuccess, regError]);

  const uploadAndRegister = useCallback(async () => {
    if (!address) return;

    setTxPhase("uploading");
    setTxError(null);

    try {
      const profile: Record<string, unknown> = { displayName: name || "Anonymous", address };
      if (bio) profile.bio = bio;
      if (website) profile.website = website;
      if (twitter) profile.twitter = twitter;
      if (github) profile.github = github;
      if (discord) profile.discord = discord;
      if (country) profile.country = country;
      if (timezone) profile.timezone = timezone;
      if (recoveryAddress) profile.recoveryAddress = recoveryAddress;

      // Upload avatar — skip if upload fails, continue without it
      if (avatar) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(avatar);
        });

        const avatarUri = await uploadFileToIpfs(base64, avatar.type, avatar.name, { purpose: "humanity_photo", wallet: address });
        if (avatarUri) {
          profile.avatarCid = avatarUri;
        } else {
          toast("error", "Avatar upload failed — continuing without avatar");
        }
      }

      // Pin metadata JSON — this MUST succeed for on-chain registration
      const metadataUri = await uploadJsonToIpfs(profile, `passport-${address}.json`);
      if (!metadataUri) {
        throw new Error("Failed to upload profile metadata. Check that IPFS is configured or try again.");
      }

      setTxPhase("signing");
      writeContract({
        address: ADDRESSES.identityRegistry,
        functionName: "register",
        args: [metadataUri],
      });
    } catch (err) {
      setTxPhase("failed");
      setTxError((err as Error).message);
      toast("error", "Registration failed");
    }
  }, [address, name, bio, website, twitter, github, discord, country, timezone, recoveryAddress, avatar, writeContract]);

  const handleNameChange = useCallback((v: string) => { setName(v); setNameError(validateName(v)); }, []);
  const handleWebsiteChange = useCallback((v: string) => { setWebsite(v); setWebsiteError(validateUrl(v)); }, []);
  const handleTwitterChange = useCallback((v: string) => { setTwitter(v); setTwitterError(validateHandle(v, "Twitter")); }, []);
  const handleGithubChange = useCallback((v: string) => { setGithub(v); setGithubError(validateHandle(v, "GitHub")); }, []);
  const handleDiscordChange = useCallback((v: string) => { setDiscord(v); setDiscordError(validateHandle(v, "Discord")); }, []);
  const handleBioChange = useCallback((v: string) => { setBio(v); setBioError(validateBio(v)); }, []);
  const handleRecoveryChange = useCallback((v: string) => { setRecoveryAddress(v); setRecoveryError(validateAddress(v)); }, []);

  const isUploading = txPhase === "uploading";
  const hasPhoto = photoStatus === "valid";
  const noErrors = !nameError && !websiteError && !twitterError && !githubError && !discordError && !bioError && !recoveryError;
  const canSubmit = name && hasPhoto && noErrors && !isSigning && !isConfirming && !isSuccess && !isUploading;

  // ── Success → activate passport → redirect ──
  useEffect(() => {
    if (!isSuccess || !address) return;
    // Skip if already activated or currently activating
    if (txPhase === "activating" || txPhase === "confirmed") return;

    const activate = async () => {
      setTxPhase("activating");
      try {
        // Wait 2 seconds for indexer to pick up the registration
        await new Promise((r) => setTimeout(r, 2000));
        const res = await fetch(
          apiUrl(`/passport/${address}/activate`),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-wallet-address": address,
            },
          }
        );
        const json = await res.json();
        if (json.success) {
          console.info("[register] Passport activated:", json.data);
        } else {
          console.warn("[register] Activation failed:", json.error);
        }
      } catch (err) {
        console.warn("[register] Activation request failed:", (err as Error).message);
      }
      setTxPhase("confirmed");
      navigate(`/passport/${address}`, { replace: true });
    };
    activate();
  }, [isSuccess, address, navigate, txPhase]);

  // ── Registration form ──
  return (
    <>
    <form onSubmit={(e) => { e.preventDefault(); if (canSubmit) uploadAndRegister(); }} className="grid gap-4">
      {/* Already registered banner */}
      {alreadyRegistered && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-md)",
            background: "rgba(0,229,160,0.06)",
            border: "1px solid rgba(0,229,160,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "1rem" }}>🪪</span>
            <div>
              <p className="t-sm" style={{ fontWeight: 600, color: "var(--color-verified)" }}>
                Identity already registered
              </p>
              <p className="t-xs c-subtle">
                {identityBalance && identityBalance > 1n
                  ? `This wallet has ${identityBalance.toString()} identity token${identityBalance > 1n ? "s" : ""}.`
                  : "This wallet already has an on-chain identity."}
                {" "}Registering again will create a new identity token.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
            <Link to={`/passport/${address}`}><Button size="sm" variant="ghost">View Passport</Button></Link>
          </div>
        </div>
      )}
      {/* Avatar + Name */}
      <Card>
        <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Identity</p>
        <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
          <AvatarUpload
            avatar={avatar} setAvatar={setAvatar}
            avatarPreview={avatarPreview} setAvatarPreview={setAvatarPreview}
            photoStatus={photoStatus} setPhotoStatus={setPhotoStatus}
            photoMessage={photoMessage} setPhotoMessage={setPhotoMessage}
          />
          <div style={{ flex: 1 }}>
            <Field label="Official Name" htmlFor="reg-name" error={nameError} helper={`${name.length}/${NAME_MAX}`}>
              <Input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Your legal / official name"
                autoComplete="off"
                maxLength={NAME_MAX}
                aria-invalid={!!nameError}
              />
            </Field>
            {!nameError && name.length >= NAME_MIN && (
              <p className="t-xs" style={{ color: "var(--color-verified)", marginTop: 4 }}>✓ Valid name</p>
            )}
          </div>
        </div>
      </Card>

      {/* Profile fields */}
      <Card>
        <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Profile</p>
        <div className="grid gap-4">
          <Field label="Bio" htmlFor="reg-bio" error={bioError} helper={`${bio.length}/${BIO_MAX} characters`}>
            <textarea
              id="reg-bio"
              value={bio}
              onChange={(e) => handleBioChange(e.target.value.slice(0, BIO_MAX))}
              placeholder="Short personal bio (no URLs or social handles)"
              maxLength={BIO_MAX}
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
            <Field label="Country" htmlFor="reg-country">
              <select
                id="reg-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="input"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {COUNTRIES.map((c) => <option key={c} value={c}>{c || "Select country"}</option>)}
              </select>
            </Field>
            <Field label="Timezone" htmlFor="reg-timezone">
              <select
                id="reg-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="input"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz || "Select timezone"}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-4)" }}>
            <Field label="Twitter / X" htmlFor="reg-twitter" error={twitterError} helper="Username only">
              <Input
                id="reg-twitter"
                type="text"
                value={twitter}
                onChange={(e) => handleTwitterChange(e.target.value)}
                placeholder="username"
              />
            </Field>
            <Field label="GitHub" htmlFor="reg-github" error={githubError} helper="Username only">
              <Input
                id="reg-github"
                type="text"
                value={github}
                onChange={(e) => handleGithubChange(e.target.value)}
                placeholder="username"
              />
            </Field>
            <Field label="Discord" htmlFor="reg-discord" error={discordError} helper="Username only">
              <Input
                id="reg-discord"
                type="text"
                value={discord}
                onChange={(e) => handleDiscordChange(e.target.value)}
                placeholder="username"
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* Recovery */}
      <Card>
        <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Security</p>
        <Field label="Recovery address" htmlFor="reg-recovery" helper="Optional. Stored in your IPFS profile metadata. On-chain recovery is not yet supported in V1." error={recoveryError}>
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

      {/* Review screen before submission */}
      {showReview && (
        <Card style={{ border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.04)" }}>
          <p className="eyebrow" style={{ marginBottom: "var(--space-3)", color: "var(--color-arc-primary)" }}>Review Humanity Profile</p>
          <div className="grid gap-2" style={{ marginBottom: "var(--space-3)" }}>
            {[
              { label: "Photo", ok: photoStatus === "valid", text: photoStatus === "valid" ? "✓ Verified" : "Required" },
              { label: "Official Name", ok: !!name && !nameError, text: name || "Required" },
              { label: "Bio", ok: !bioError, text: bio || "Optional" },
              { label: "Twitter", ok: !twitterError && !!twitter, text: twitter || "Optional" },
              { label: "GitHub", ok: !githubError && !!github, text: github || "Optional" },
              { label: "Discord", ok: !discordError && !!discord, text: discord || "Optional" },
              { label: "Country", ok: !!country, text: country || "Optional" },
              { label: "Timezone", ok: !!timezone, text: timezone || "Optional" },
              { label: "Website", ok: !websiteError && !!website, text: website || "Optional" },
              { label: "Recovery", ok: !recoveryError, text: recoveryAddress ? `${recoveryAddress.slice(0, 10)}...` : "Optional" },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                <span className="t-xs c-subtle" style={{ minWidth: 90 }}>{row.label}</span>
                <span className="t-xs" style={{ color: row.ok ? "var(--color-verified)" : "var(--color-subtle)", textAlign: "right" }}>
                  {row.ok ? "✓" : "○"} {row.text}
                </span>
              </div>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", cursor: "pointer", marginBottom: "var(--space-3)" }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: 3 }} />
            <span className="t-xs c-muted" style={{ lineHeight: 1.5 }}>
              I confirm this information belongs to me and is accurate. I understand each person may create only one Humanity ID.
            </span>
          </label>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button type="submit" block disabled={!confirmed || !canSubmit} loading={isUploading || isSigning || isConfirming}>
              Submit & Register
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowReview(false)}>Edit</Button>
          </div>
        </Card>
      )}

      {/* Gas estimate */}
      {!showReview && <GasEstimateCard enabled={!!canSubmit && !!ADDRESSES.identityRegistry} registryAddress={ADDRESSES.identityRegistry} />}

      {/* Tx phase tracker */}
      <TxPhaseTracker phase={txPhase} hash={hash} error={txError} />

      {!showReview && (
        <Button
          type="button"
          block
          disabled={!canSubmit}
          onClick={() => setShowReview(true)}
        >
          Review & Submit
        </Button>
      )}

      {regError && txPhase !== "failed" && (
        <p className="c-danger t-sm text-center">{parseContractError(regError)}</p>
      )}
    </form>

    {/* Success guidance */}
    {txPhase === "confirmed" && (
      <Card style={{ border: "1px solid rgba(0,229,160,0.3)", background: "rgba(0,229,160,0.04)" }}>
        <p className="eyebrow" style={{ marginBottom: "var(--space-3)", color: "var(--color-verified)" }}>🎉 What happens next</p>
        <div className="grid gap-2">
          {[
            { icon: "🪪", label: "View your passport", desc: "See your on-chain identity and profile.", href: `/passport/${address}` },
            { icon: "🛡️", label: "Verify your humanity", desc: "Complete the liveness check for a trust score boost.", href: "/world-id" },
            { icon: "🔗", label: "Link your accounts", desc: "Connect GitHub, Twitter, or Discord for more attestations.", href: "/openid3" },
            { icon: "📋", label: "Request credentials", desc: "Ask issuers for KYC, employment, or education attestations.", href: "/guide" },
          ].map((step) => (
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
                border: "1px solid var(--color-border)",
                textDecoration: "none",
                color: "var(--color-on-surface)",
                transition: "background 0.15s",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: "1rem" }}>{step.icon}</span>
              <div style={{ flex: 1 }}>
                <p className="t-sm" style={{ fontWeight: 600 }}>{step.label}</p>
                <p className="t-xs c-subtle">{step.desc}</p>
              </div>
              <span style={{ color: "var(--color-subtle)", fontSize: "0.7rem" }}>→</span>
            </Link>
          ))}
        </div>
      </Card>
    )}

    {/* Quest categories — what you can earn after registration */}
    <Card>
      <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Trust Score Quest</p>
      <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-3)" }}>
        Registering your identity awards 0 points — it only creates your on-chain identity token. Points are earned when authorized issuers attest credentials to your address. Each category below shows its max contribution toward the 20-point threshold.
      </p>
      <div className="grid gap-1">
        {[
          { icon: "🪪", label: "Identity & Passport", points: 4, color: "#3B82F6" },
          { icon: "🛡️", label: "KYC / Compliance", points: 10, color: "#00E5A0" },
          { icon: "📜", label: "Professional Credentials", points: 8, color: "#8B5CF6" },
          { icon: "🏛️", label: "DAO & Governance", points: 7, color: "#F59E0B" },
          { icon: "⭐", label: "Reputation & Trust", points: 3, color: "#EC4899" },
          { icon: "💼", label: "Employment & HR", points: 5, color: "#06B6D4" },
          { icon: "🎓", label: "Education", points: 5, color: "#10B981" },
          { icon: "🔗", label: "Social Verification", points: 2, color: "#F97316" },
          { icon: "✨", label: "Custom / Open", points: 2, color: "#6366F1" },
        ].map((cat) => (
          <div
            key={cat.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "var(--space-1) var(--space-2)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            <span style={{ fontSize: "0.8rem", width: 20, textAlign: "center", flexShrink: 0 }}>{cat.icon}</span>
            <span className="t-xs" style={{ flex: 1, color: "var(--color-on-surface)" }}>{cat.label}</span>
            <span className="mono t-xs" style={{ color: cat.color, fontWeight: 600, minWidth: 28, textAlign: "right", flexShrink: 0 }}>
              +{cat.points}
            </span>
          </div>
        ))}
      </div>
      <p className="t-xs c-subtle text-center" style={{ marginTop: "var(--space-3)" }}>
        20 points to pass · 100 max score
      </p>
    </Card>
    </>
  );
}
