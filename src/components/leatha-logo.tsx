import type { SVGProps } from "react";

/**
 * Leatha brand mark — a circle containing two capital "A"s facing each other.
 * Uses `currentColor` everywhere so it adapts to any theme color.
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
      fill="none"
      stroke="currentColor"
      {...props}
    >
      {/* outer ring */}
      <circle cx="50" cy="50" r="44" strokeWidth="6" />

      {/* Left "A" — apex points right */}
      {/* outer legs */}
      <path
        d="M40 28 L20 72 M40 28 L60 50 L40 72"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* crossbar */}
      <path d="M27 56 L48 56" strokeWidth="6" strokeLinecap="round" />

      {/* Right "A" — apex points left (mirror) */}
      <path
        d="M60 28 L80 72 M60 28 L40 50 L60 72"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M52 56 L73 56" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export default LeathaLogo;
