"use client";

import { motion } from "framer-motion";
import { FileText, QrCode, Smartphone } from "lucide-react";

const STEPS = ["Subís tu carta en PDF", "Nexo genera una página lista para compartir", "Imprimís el QR en tus mesas"];

// Sección 8 del pedido: "funcionalidad avanzada", Profesional en adelante.
// Mismo patrón visual que product-preview.tsx (mockup de navegador a la
// derecha) para no introducir un lenguaje visual nuevo en la landing.
export function LandingMenuShowcase() {
  return (
    <section id="carta" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="order-2 flex items-center justify-center gap-6 lg:order-1"
          >
            <div className="w-40 overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/5">
              <div className="h-16 bg-gradient-to-br from-primary/25 to-primary/5" />
              <div className="space-y-2 p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                  <FileText className="size-3" />
                  Carta
                </div>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-2.5 rounded-full bg-muted" style={{ width: `${85 - i * 12}%` }} />
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex size-24 items-center justify-center rounded-2xl border border-border bg-white p-3 shadow-lg">
                <QrCode className="size-full text-foreground" strokeWidth={1.25} />
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Smartphone className="size-3" />
                Escaneá y mirá
              </span>
            </div>
          </motion.div>

          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Disponible desde el plan Profesional
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
              Tu carta siempre disponible
            </h2>
            <p className="mt-5 text-muted-foreground">
              Cargá tu carta en PDF y Nexo arma una página de carta optimizada para tu sitio, más un QR
              que siempre apunta a la última versión — imprimilo una sola vez, aunque cambies precios o
              productos.
            </p>

            <ol className="mt-6 space-y-3">
              {STEPS.map((step, index) => (
                <motion.li
                  key={step}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  className="flex items-center gap-3 text-sm text-foreground"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {index + 1}
                  </span>
                  {step}
                </motion.li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
