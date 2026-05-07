import { motion } from "framer-motion";

type BlobConfig = {
  className: string;
  animate: {
    x: number[];
    y: number[];
    scale: number[];
  };
  duration: number;
};

const blobs: BlobConfig[] = [
  {
    className:
      "left-[-12%] top-[-8%] h-[34rem] w-[34rem] bg-[oklch(0.9_0.08_255_/_0.42)] dark:bg-[oklch(0.34_0.06_255_/_0.22)]",
    animate: { x: [0, 80, -30], y: [0, 50, 120], scale: [1, 1.14, 0.98] },
    duration: 26,
  },
  {
    className:
      "right-[-14%] top-[8%] h-[30rem] w-[30rem] bg-[oklch(0.9_0.09_320_/_0.34)] dark:bg-[oklch(0.31_0.07_305_/_0.2)]",
    animate: { x: [0, -110, -20], y: [0, 120, 40], scale: [1.02, 0.92, 1.08] },
    duration: 24,
  },
  {
    className:
      "bottom-[-18%] left-[14%] h-[28rem] w-[28rem] bg-[oklch(0.93_0.07_70_/_0.26)] dark:bg-[oklch(0.29_0.05_55_/_0.16)]",
    animate: { x: [0, 90, 30], y: [0, -90, -20], scale: [0.94, 1.08, 1] },
    duration: 28,
  },
  {
    className:
      "bottom-[-10%] right-[8%] h-[26rem] w-[26rem] bg-[oklch(0.91_0.07_180_/_0.22)] dark:bg-[oklch(0.28_0.05_200_/_0.14)]",
    animate: { x: [0, -60, 40], y: [0, -70, -10], scale: [1, 1.12, 0.96] },
    duration: 22,
  },
];

export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      {blobs.map((blob, index) => (
        <motion.div
          key={index}
          className={`absolute rounded-full blur-3xl ${blob.className}`}
          animate={blob.animate}
          transition={{
            duration: blob.duration,
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "mirror",
            ease: "linear",
          }}
        />
      ))}
      <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] dark:bg-background/60" />
    </div>
  );
}