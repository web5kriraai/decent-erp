import { cn } from "@/lib/utils";
import { BRAND_ASSETS } from "@/config/brand-assets";

const VARIANTS = {
  full: BRAND_ASSETS.logo,
  mark: BRAND_ASSETS.logoMark,
} as const;

const SIZES = {
  sm: { width: 40, height: 40, className: "h-9 w-9 sm:h-10 sm:w-10" },
  md: { width: 56, height: 56, className: "h-12 w-12 sm:h-14 sm:w-14" },
  lg: { width: 160, height: 160, className: "h-auto w-[min(100%,9rem)] sm:w-[min(100%,10rem)]" },
} as const;

export type BrandLogoSize = keyof typeof SIZES;
export type BrandLogoVariant = keyof typeof VARIANTS;

type BrandLogoProps = {
  size?: BrandLogoSize;
  variant?: BrandLogoVariant;
  className?: string;
  priority?: boolean;
  alt?: string;
};

/** Transparent brand mark/wordmark from /brand. No black plate on light chrome. */
export function BrandLogo({
  size = "md",
  variant = "mark",
  className,
  priority = false,
  alt = "Decent Technologies",
}: BrandLogoProps) {
  const dims = SIZES[size];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static public brand asset
    <img
      src={VARIANTS[variant]}
      alt={alt}
      width={dims.width}
      height={dims.height}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : {})}
      className={cn("block object-contain bg-transparent", dims.className, className)}
    />
  );
}
