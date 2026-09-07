"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { useApiToast } from "@/components/ui/ToastProvider";
import {
  createPendingMediaId,
  type PendingConceptMedia,
  uploadConceptMediaFile,
} from "@/lib/concept-media-upload";

type AudioRecorderProps = {
  designId?: string;
  onUploaded?: () => void;
  disabled?: boolean;
  /** Queue recorded blob for create form instead of uploading. */
  queueMode?: boolean;
  onQueued?: (item: PendingConceptMedia) => void;
};

type RecorderState = "idle" | "recording" | "preview" | "uploading";

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function AudioRecorder({
  designId,
  onUploaded,
  disabled,
  queueMode = false,
  onQueued,
}: AudioRecorderProps) {
  const toast = useApiToast();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [supported, setSupported] = useState(true);
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined",
    );
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clearPreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setSeconds(0);
    setState("idle");
    setError(null);
  }, [previewUrl]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  async function startRecording() {
    if (disabled || !supported) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        setPreviewBlob(blob);
        setPreviewUrl(url);
        setState("preview");
      };
      recorder.start(250);
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      stopTracks();
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied. Allow mic access to record a voice note."
          : "Could not access the microphone.";
      setError(message);
      toast.error("Recording unavailable", message);
      setState("idle");
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  async function sendRecording() {
    if (!previewBlob) return;
    const ext = previewBlob.type.includes("ogg")
      ? "ogg"
      : previewBlob.type.includes("mp4")
        ? "m4a"
        : "webm";
    const file = new File([previewBlob], `voice-note-${Date.now()}.${ext}`, {
      type: previewBlob.type || "audio/webm",
    });

    if (queueMode) {
      onQueued?.({
        id: createPendingMediaId(),
        file,
        mediaKind: "AUDIO",
        previewUrl: previewUrl ?? URL.createObjectURL(previewBlob),
      });
      // Keep previewUrl ownership with pending item — don't revoke here.
      setPreviewUrl(null);
      setPreviewBlob(null);
      setSeconds(0);
      setState("idle");
      toast.success("Voice note added", "Queued for upload after create");
      return;
    }

    if (!designId) return;
    setState("uploading");
    try {
      await uploadConceptMediaFile({
        designId,
        file,
        mediaKind: "AUDIO",
      });
      toast.success("Voice note uploaded", file.name);
      clearPreview();
      onUploaded?.();
    } catch (error) {
      toast.errorFromApi(error, "Upload failed");
      setState("preview");
    }
  }

  if (!supported) {
    return (
      <p className="m-0 text-sm text-[var(--color-neutral-600)]">
        Audio recording is not supported in this browser. Upload a voice file instead.
      </p>
    );
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div
      className="vstack vstack--tight w-full rounded border border-[var(--border)] p-3"
      style={{
        background: "color-mix(in srgb, var(--color-primary-light) 40%, var(--card))",
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Record voice note</span>
        {state === "recording" ? (
          <span className="badge" style={{ background: "var(--color-danger)", color: "#fff" }}>
            REC {mm}:{ss}
          </span>
        ) : null}
        {state === "uploading" ? (
          <span className="text-sm text-[var(--color-neutral-600)]">Uploading…</span>
        ) : null}
      </div>

      {error ? (
        <p className="m-0 text-sm text-[var(--color-danger)]">{error}</p>
      ) : null}

      {previewUrl && state !== "uploading" ? (
        <audio controls src={previewUrl} className="w-full" />
      ) : null}

      {state === "uploading" ? (
        <div
          role="progressbar"
          aria-valuenow={50}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            height: 6,
            borderRadius: 3,
            background: "var(--border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "70%",
              height: "100%",
              background: "var(--color-primary)",
              animation: "pulse 1.2s ease-in-out infinite",
            }}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {state === "idle" ? (
          <AppButton
            type="button"
            appVariant="primary"
            size="sm"
            disabled={disabled}
            onClick={() => void startRecording()}
          >
            Start recording
          </AppButton>
        ) : null}
        {state === "recording" ? (
          <AppButton type="button" appVariant="danger" size="sm" onClick={stopRecording}>
            Stop
          </AppButton>
        ) : null}
        {state === "preview" ? (
          <>
            <AppButton
              type="button"
              appVariant="primary"
              size="sm"
              disabled={disabled}
              onClick={() => void sendRecording()}
            >
              {queueMode ? "Add to queue" : "Send"}
            </AppButton>
            <AppButton type="button" appVariant="ghost" size="sm" onClick={clearPreview}>
              Discard
            </AppButton>
          </>
        ) : null}
      </div>
    </div>
  );
}
