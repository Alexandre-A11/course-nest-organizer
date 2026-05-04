import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Props {
  src: string;
  fileName: string;
  className?: string;
  onEnded?: () => void;
  onLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onTimeUpdate?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onPause?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  registerRef?: (el: HTMLVideoElement | null) => void;
}

/**
 * Video player that uses the native <video> tag for mp4/webm and falls back
 * to mpegts.js for MPEG-TS (.ts) streams which the browser cannot decode
 * natively.
 */
export function CustomVideoPlayer({
  src, fileName, className, onEnded, onLoadedMetadata, onTimeUpdate, onPause, registerRef,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const isTs = ext === "ts";

  useEffect(() => {
    if (!isTs) return;
    const el = videoRef.current;
    if (!el) return;
    type Player = {
      attachMediaElement: (el: HTMLVideoElement) => void;
      load: () => void;
      destroy: () => void;
    };
    let player: Player | null = null;
    let cancelled = false;
    (async () => {
      const mod = await import("mpegts.js");
      const mpegts = mod.default;
      if (cancelled || !mpegts.getFeatureList().mseLivePlayback && !mpegts.isSupported()) return;
      player = mpegts.createPlayer({ type: "mpegts", url: src, isLive: false }) as unknown as Player;
      player.attachMediaElement(el);
      player.load();
    })();
    return () => {
      cancelled = true;
      try { player?.destroy(); } catch { /* ignore */ }
    };
  }, [src, isTs]);

  return (
    <video
      key={src}
      ref={(el) => { videoRef.current = el; registerRef?.(el); }}
      src={isTs ? undefined : src}
      controls
      className={cn(className)}
      onEnded={onEnded}
      onLoadedMetadata={onLoadedMetadata}
      onTimeUpdate={onTimeUpdate}
      onPause={onPause}
    />
  );
}