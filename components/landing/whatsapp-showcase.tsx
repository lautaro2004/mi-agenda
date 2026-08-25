"use client";

import { motion } from "framer-motion";
import { Bot, CheckCheck, MessageCircle, Zap } from "lucide-react";

const CONVERSATION = [
  { from: "customer" as const, text: "Hola! ¿Cuánto sale el corte + barba y tienen lugar hoy?" },
  { from: "assistant" as const, text: "¡Hola! El combo corte + barba sale $6.500. Hoy tenemos lugar a las 17:30 y a las 18:15." },
  { from: "customer" as const, text: "Dale, a las 18:15 para mí" },
  { from: "assistant" as const, text: "Perfecto, te reservo el turno de las 18:15 para corte + barba. ¡Te esperamos!" },
];

const HIGHLIGHTS = [
  { icon: Bot, label: "Responde solo", description: "Precios, horarios y disponibilidad, sin que vos escribas." },
  { icon: Zap, label: "Al instante", description: "Contesta apenas llega el mensaje, a cualquier hora." },
  { icon: CheckCheck, label: "Confirma reservas", description: "Detecta la intención y agenda el turno en la misma charla." },
];

// Sección comercial más importante después del hero (ver pedido: "una de
// las secciones comerciales más importantes"). Reutiliza el mismo patrón
// visual de burbujas de chat que hero.tsx/teach-not-configure.tsx, con
// header estilo WhatsApp para que se lea de un vistazo como ESE canal
// puntual — no una conversación genérica más.
export function LandingWhatsappShowcase() {
  return (
    <section id="whatsapp" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Disponible desde el plan Esencial
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
              Tu WhatsApp también puede atender
            </h2>
            <p className="mt-5 text-muted-foreground">
              Mientras vos trabajás, Nexo responde las consultas de tus clientes por WhatsApp con la
              información real de tu negocio — y si hace falta, confirma la reserva ahí mismo.
            </p>

            <div className="mt-8 space-y-4">
              {HIGHLIGHTS.map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.4, delay: index * 0.06 }}
                  className="flex items-start gap-3"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <item.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-emerald-500/10"
          >
            <div className="flex items-center gap-2.5 bg-emerald-600 px-4 py-3.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-white/15 text-white">
                <MessageCircle className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Barbería del Centro</p>
                <p className="text-[11px] text-emerald-100">en línea</p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 bg-[#e5ddd5] p-5 dark:bg-muted/40 sm:p-6">
              {CONVERSATION.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.35, delay: i * 0.12 }}
                  className={`flex ${msg.from === "customer" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                      msg.from === "customer" ? "bg-white text-foreground dark:bg-card" : "bg-emerald-100 text-foreground dark:bg-emerald-500/20"
                    }`}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="border-t border-border bg-muted/20 px-5 py-3 text-center text-xs font-medium text-muted-foreground sm:px-6">
              Respondido automáticamente por Nexo
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
