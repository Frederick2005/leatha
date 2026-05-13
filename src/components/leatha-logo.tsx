import type { ImgHTMLAttributes } from "react";
import leathaLogoImage from "@/assets/leatha-logo.png";

/**
 * Leatha brand mark — displays the Leatha logo from the assets folder.
 * 
 * Usage: <LeathaLogo size={32} />
 */
export function LeathaLogo({ size = 32, ...props }: ImgHTMLAttributes<HTMLImageElement> & { size?: number }) {
  return (
    <img
      src={leathaLogoImage}
      alt="Leatha"
      width={size}
      height={size}
      role="img"
      {...props}
    />
  );
}

export default LeathaLogo;
