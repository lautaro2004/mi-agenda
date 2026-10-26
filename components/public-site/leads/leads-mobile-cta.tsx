"use client";

import * as React from "react";
import { ArrowDown } from "lucide-react";

import { cn } from "@/lib/utils";

// Barra fija con el botón principal, solo en mobile. Aparece cuando el
// visitante ya pasó el hero (el botón del hero ya no se ve) y se esconde
// cuando el formulario está en pantalla — nunca tapa el propio formulario.
// Mismo lugar que la barra de reservas de la plantilla booking (el botón de
// WhatsApp flotante se levanta para no superponerse: liftedOnMobile).
export function LeadsMobileCta({ label, tone }: { label: string; tone: "light" | "dark" }) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const form = document.getElementById("contacto");
    let pastHero = false;
    let formInView = false;
    const update = () => setVisible(pastHero && !formInView);

    const onScroll = () => {
      pastHero = window.scrollY > window.innerHeight * 0.7;
      update();
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const observer = form
      ? new IntersectionObserver(([entry]) => {
          formInView = entry.isIntersecting;
          update();
        })
      : null;
    if (form && observer) observer.observe(form);

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 p-3 backdrop-blur-md transition-transform duration-300 motion-reduce:transition-none sm:hidden",
        visible ? "translate-y-0" : "translate-y-full"
      )}
      aria-hidden={!visible}
    >
      <a
        href="#contacto"
        tabIndex={visible ? 0 : -1}
        className={cn(
          "flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary,var(--primary))] text-[0.95rem] font-semibold",
          tone === "light" ? "text-white" : "text-neutral-950"
        )}
      >
        {label}
        <ArrowDown className="size-4" />
      </a>
    </div>
  );
}
