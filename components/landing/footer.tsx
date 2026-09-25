import Link from "next/link";
import Image from "next/image";

export function LandingFooter() {
  return (
    <footer className="border-t border-border px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
            <Image src="/logo-nexo-mark.png" alt="Nexo" width={28} height={28} className="size-7" />
            Nexo
          </Link>
          <p className="text-xs text-muted-foreground">Un producto de Kodexa</p>
        </div>
        <div className="flex flex-col items-center gap-2 sm:items-end">
          <div className="flex gap-4">
            <Link href="/terminos" className="hover:text-foreground hover:underline">Términos</Link>
            <Link href="/privacidad" className="hover:text-foreground hover:underline">Privacidad</Link>
          </div>
          <p>© {new Date().getFullYear()} Nexo. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
