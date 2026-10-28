import { BRAND_ICON_PATHS, type BrandIconName } from "@/lib/brand-icon-paths";
import { SOCIAL_ICON, type SocialLink } from "@/lib/social";
import { cn } from "@/lib/utils";

export function BrandIcon({ name, className }: { name: BrandIconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={cn("size-[18px]", className)}>
      <path d={BRAND_ICON_PATHS[name]} />
    </svg>
  );
}

// Una red = su propio ícono de marca (nunca uno genérico). Cada enlace lleva
// nombre accesible ("Instagram") y abre en pestaña nueva sin darle acceso al
// sitio de origen (noopener) ni enviarle el referente.
export function SocialLinks({
  links,
  className,
  linkClassName,
  iconClassName,
}: {
  links: SocialLink[];
  className?: string;
  linkClassName?: string;
  iconClassName?: string;
}) {
  if (links.length === 0) return null;
  return (
    <ul aria-label="Redes sociales" className={cn("flex items-center gap-3", className)}>
      {links.map((link) => (
        <li key={link.platform}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.label}
            title={link.label}
            className={cn("text-muted-foreground transition-colors hover:text-foreground", linkClassName)}
          >
            <BrandIcon name={SOCIAL_ICON[link.platform]} className={iconClassName} />
          </a>
        </li>
      ))}
    </ul>
  );
}
