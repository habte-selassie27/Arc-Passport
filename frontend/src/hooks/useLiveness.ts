/**
 * useLiveness.ts
 *
 * Custom webcam-liveness flow:
 * 1. Backend issues a random action sequence (blink / turn_left / turn_right).
 * 2. MediaPipe FaceLandmarker runs fully client-side to enforce each step.
 * 3. Keyframes are captured as evidence and submitted for verification.
 *
 * PRIVACY: frames stay in this tab until submission; only the chosen evidence
 * frames are sent, processed in backend memory, never stored.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { apiUrl } from "../config/api";
import { signedFetch } from "../utils/signedApi";

export interface LivenessStatus {
  subject: string;
  verified: boolean;
  onChain: boolean;
  mechanism?: string;
  claimId?: string;
  checkedAt?: number;
  expiresAt?: number;
  source?: "oracle" | "legacy";
}

/** Public, read-only camera-liveness verification status for an address. */
export function useLivenessStatus(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["liveness-status", address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(apiUrl(`/liveness/status/${address}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to load status");
      return json.data as LivenessStatus;
    },
    enabled: !!address,
  });
}

export type LivenessAction = "blink" | "turn_left" | "turn_right";

export type LivenessPhase =
  | "idle"
  | "starting"
  | "running"
  | "submitting"
  | "done"
  | "failed";

const BLINK_ON = 0.5;
const BLINK_OFF = 0.2;
const TURN_RAD = 0.32; // ~18°
const HOLD_MS = 250;

interface Challenge {
  challengeId: string;
  steps: LivenessAction[];
  expiresAt: number;
}

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 1,
      });
    })().catch((err) => {
      landmarkerPromise = null; // allow retry on next attempt
      throw err;
    });
  }
  return landmarkerPromise;
}

function captureFrame(video: HTMLVideoElement): string | null {
  const canvas = document.createElement("canvas");
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  // Downscale for transmission economy — enough for structural review only.
  const scale = Math.min(1, 480 / w);
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.6);
}

export function useLiveness() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [phase, setPhase] = useState<LivenessPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepProgress, setStepProgress] = useState(0); // 0..1 within current step

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const runLoop = useCallback(
    (ch: Challenge, startTs: number) => {
      let lastVideoTime = -1;
      let blinkArmed = true;
      let turnBaseline: number | null = null;
      let holdStart = 0;
      let frames: string[] = [];
      let landmarks: any[] = [];
      let doneSteps: LivenessAction[] = [];

      const tick = async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(() => void tick());
          return;
        }
        try {
          const lm = await getLandmarker();
          if (video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const res = lm.detectForVideo(video, performance.now());
            const shapes = res.faceBlendshapes?.[0]?.categories ?? [];
            const blink =
              (shapes.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0) * 0.5 +
              (shapes.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0) * 0.5;
            const mat = res.facialTransformationMatrixes?.[0]?.data;
            const yaw = mat ? Math.atan2(mat[8], mat[10]) : 0;

            const target = ch.steps[doneSteps.length];
            let progress = 0;

            if (target === "blink") {
              if (blink > BLINK_ON && blinkArmed) {
                blinkArmed = false;
                holdStart = performance.now();
              }
              if (!blinkArmed && blink < BLINK_OFF && performance.now() - holdStart > 80) {
                blinkArmed = true;
                progress = 1;
              }
              if (blink < BLINK_OFF) blinkArmed = true;
            } else {
              if (turnBaseline === null) turnBaseline = yaw;
              const delta = target === "turn_left" ? turnBaseline - yaw : yaw - turnBaseline;
              progress = delta > TURN_RAD ? 1 : Math.max(0, delta / TURN_RAD);
              if (delta > TURN_RAD) {
                if (!holdStart) holdStart = performance.now();
                if (performance.now() - holdStart >= HOLD_MS) progress = 1;
              } else {
                holdStart = 0;
              }
            }

            setStepProgress(progress);
            if (progress >= 1) {
              const frame = captureFrame(video);
              if (frame) frames.push(frame);
              // Capture facial landmarks for biometric hashing.
              const lm = await getLandmarker();
              const faceResult = lm.detectForVideo(video, performance.now());
              if (faceResult.faceLandmarks?.[0]) {
                landmarks = faceResult.faceLandmarks[0];
              }
              doneSteps.push(target);
              setStepIndex(doneSteps.length);
              setStepProgress(0);
              blinkArmed = true;
              turnBaseline = null;
              holdStart = 0;

              if (doneSteps.length === ch.steps.length) {
                const last = captureFrame(video);
                if (last) frames.push(last);
                setPhase("submitting");
                stopCamera();
                try {
                  await signedFetch({
                    path: "/liveness/verify",
                    address: address!,
                    signMessage: signMessageAsync,
                    method: "POST",
                    body: { challengeId: ch.challengeId, steps: doneSteps, frames, landmarks },
                  });
                  setPhase("done");
                } catch (err) {
                  setError((err as Error).message);
                  setPhase("failed");
                }
                return;
              }
            }
          }
          if (Date.now() - startTs > ch.expiresAt - Date.now() + 60_000) {
            // safety net against runaway loops
            setError("Liveness session timed out");
            setPhase("failed");
            stopCamera();
            return;
          }
        } catch {
          /* transient detector hiccup — keep going */
        }
        rafRef.current = requestAnimationFrame(() => void tick());
      };

      rafRef.current = requestAnimationFrame(() => void tick());
    },
    [address, signMessageAsync, stopCamera]
  );

  const start = useCallback(async () => {
    setError(null);
    setStepIndex(0);
    setStepProgress(0);
    setPhase("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      await getLandmarker(); // fail fast if WASM/model unavailable

      const data = await signedFetch<Challenge>({
        path: "/liveness/challenge",
        address: address!,
        signMessage: signMessageAsync,
        method: "POST",
      });
      setChallenge(data);
      setPhase("running");
      runLoop(data, Date.now());
    } catch (err) {
      setError(
        (err as Error).name === "NotAllowedError"
          ? "Camera access was denied — allow camera permission and try again."
          : (err as Error).message
      );
      setPhase("failed");
      stopCamera();
    }
  }, [address, signMessageAsync, runLoop, stopCamera]);

  const reset = useCallback(() => {
    stopCamera();
    setError(null);
    setChallenge(null);
    setStepIndex(0);
    setStepProgress(0);
    setPhase("idle");
  }, [stopCamera]);

  return { phase, error, challenge, stepIndex, stepProgress, videoRef, start, reset };
}
