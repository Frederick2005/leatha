import type { SVGProps } from "react";

/**
 * Leatha brand mark — copper ring around a horizontal diamond with a centered hexagon.
 * Pure SVG so it stays crisp at every size and inherits currentColor where useful.
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
      {/* copper ring */}
      <circle cx="50" cy="50" r="44" fill="none" stroke="#C2855A" strokeWidth="7" />
      {/* horizontal diamond */}
      <polygon points="14,50 50,34 86,50 50,66" fill="#FFFFFF" />
      {/* centered hexagon */}
      <polygon
        points="50,40 57,44 57,52 50,56 43,52 43,44"
        fill="#0A0A0A"
      />
    </svg>
  );
}

export default LeathaLogo;
