/**
 * Aurora background — Aceternity UI.
 *
 * Pure CSS / GPU-composited animation: a large multi-stop conic + radial
 * gradient on a fixed layer, animated via `background-position`. Because
 * nothing is repainted on the JS thread (no framer-motion, no canvas), it
 * never flickers and stays buttery smooth across viewport resizes and
 * theme changes. Light/dark palettes are switched declaratively through
 * the `[data-aurora]` selector + `.dark` variant defined in `styles.css`.
 */
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      <div className="aurora-stage absolute inset-[-10%] opacity-70 dark:opacity-50" />
      <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] dark:bg-background/60" />
    </div>
  );
}