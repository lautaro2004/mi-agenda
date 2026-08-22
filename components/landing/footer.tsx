import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-border px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
              N
            </span>
            Nexo
          </Link>
          <p className="text-xs text-muted-foreground">Un producto de Kodexa</p>
        </div>
        <p>© {new Date().getFullYear()} Nexo. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
