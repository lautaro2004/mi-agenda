import Link from "next/link";
import { MessageCircle } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-border px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageCircle className="size-3.5" />
          </span>
          Mi Agenda
        </Link>
        <p>© {new Date().getFullYear()} Mi Agenda. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
