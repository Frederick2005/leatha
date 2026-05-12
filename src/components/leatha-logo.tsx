import type { SVGProps } from "react";

/**
 * Leatha brand mark — two capital "A"s rotated 90° (left A's apex points right,
 * right A's apex points left) inside a circle. Uses `currentColor` so it adapts
 * to any theme color, and `fill-rule="evenodd"` so the inner counter of each
 * "A" is transparent (no hard-coded background color).
 *
 * Usage: <LeathaLogo size={32} className="text-primary" />
 */
export function LeathaLogo({ size = 32, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
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
      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6" />

      {/* Left "A" rotated 90° CW — apex points right.
          Outer triangle minus inner triangle (counter) via evenodd. */}
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M16 24 L16 76 L49 50 Z M26 38 L26 62 L41 50 Z"
      />

      {/* Right "A" — mirror, apex points left. */}
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M84 24 L84 76 L51 50 Z M74 38 L74 62 L59 50 Z"
      />
    </svg>
  );
}

export default LeathaLogo;
