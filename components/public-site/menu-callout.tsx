import Link from "next/link";
import { ArrowRight, ScrollText } from "lucide-react";

interface MenuCalloutProps {
  slug: string;
}

// Banda angosta, no una sección grande — la carta es un complemento del
// sitio, no el contenido principal (salvo para quien ya viene de un QR, que
// entra directo a /s/[slug]/carta sin pasar por acá). Solo se renderiza
// cuando el caller ya confirmó menuEnabled && menuPdfUrl (ver
// app/s/[slug]/page.tsx) — nunca decide sola si corresponde mostrarse.
export function MenuCallout({ slug }: MenuCalloutProps) {
  return (
    <section className="border-y border-border bg-muted/20">
      <Link
        href={`/s/${slug}/carta`}
        className="mx-auto flex max-w-6xl items-center justify-center gap-2.5 px-4 py-4 text-sm font-medium text-foreground transition-colors hover:text-[var(--brand-primary,var(--primary))] sm:px-6"
      >
        <ScrollText className="size-4 shrink-0" />
        Ver nuestra carta
        <ArrowRight className="size-3.5 shrink-0" />
      </Link>
    </section>
  );
}
