import Link from "next/link";
import Image from "next/image";

// Mientras esto sea true se muestra un aviso de borrador: los textos legales
// de app/privacidad y app/terminos fueron redactados sin revisión de un
// abogado. Pasarlo a false recién cuando estén revisados.
const LEGAL_DRAFT = true;

export const LEGAL_CONTACT_EMAIL = "contacto@kodexa.ar";

export function LegalPage({ title, updatedAt, children }: { title: string; updatedAt: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold text-foreground">
        <Image src="/logo-nexo-mark.png" alt="Nexo" width={28} height={28} className="size-7" />
        Nexo
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: {updatedAt}</p>
      {LEGAL_DRAFT && (
        <p className="mt-6 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          Versión preliminar, pendiente de revisión legal.
        </p>
      )}
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
