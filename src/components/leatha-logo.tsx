import type { SVGProps } from "react";

/**
 * Leatha brand mark — a circle containing two capital "A"s rotated 90°,
 * mirrored so their apexes meet in the center (forming a horizontal diamond
 * with a small gap between the tips).
 *
 * Uses `currentColor` so the mark adapts to any theme color.
 *
 * Usage: <LeathaLogo size={32} className="text-primary" />
 */
export function LeathaLogo({
  size = 32,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="Leatha"
      {...props}
    >
      {/* outer ring */}
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
      />

      {/*
        Left "A" rotated 90° clockwise:
        - base (the two legs) is vertical on the far left
        - apex points right toward the center
        - crossbar sits near the apex
      */}
      <polygon
        points="18,22 18,78 47,50"
        fill="currentColor"
      />
      {/* notch to form the inner triangle of the A (the counter) */}
      <polygon
        points="26,38 26,62 42,50"
        fill="var(--logo-bg, #000)"
      />

      {/*
        Right "A" — mirror of the left one, apex pointing left.
      */}
      <polygon
        points="82,22 82,78 53,50"
        fill="currentColor"
      />
      <polygon
        points="74,38 74,62 58,50"
        fill="var(--logo-bg, #000)"
      />
    </svg>
  );
}

export default LeathaLogo;
