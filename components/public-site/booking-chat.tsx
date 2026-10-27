"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";

import { cn } from "@/lib/utils";

interface BookingChatProps {
  slug: string;
  businessName: string;
  // La plantilla booking agrega una barra fija al pie en mobile.
  liftedOnMobile?: boolean;
}

interface Turn {
  role: "user" | "model";
  text: string;
}

const MAX_CHARS = 500;
const GREETING = "¡Hola! Soy el asistente de reservas. Contame qué servicio querés y para qué día, y te busco horarios.";

// Chat de reservas con IA. Solo habla con /api/public/[slug]/chat: toda la
// disponibilidad y la creación del turno las resuelve el servidor. Si el chat
// no está disponible, el formulario de reserva sigue siendo la vía normal.
export function BookingChat({ slug, businessName, liftedOnMobile }: BookingChatProps) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([{ role: "model", text: GREETING }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, open, sending]);

  async function send() {
    const message = input.trim();
    if (!message || sending) return;
    // El saludo inicial no se manda como historial: el modelo no lo necesita.
    const history = turns.slice(1);
    setTurns((t) => [...t, { role: "user", text: message }]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch(`/api/public/${slug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = (await res.json().catch(() => null)) as { reply?: string; error?: string } | null;
      const text = data?.reply ?? data?.error ?? "No pude responder ahora. Probá con el formulario de reserva.";
      setTurns((t) => [...t, { role: "model", text }]);
    } catch {
      setTurns((t) => [...t, { role: "model", text: "No pude conectarme. Probá de nuevo o usá el formulario de reserva." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label={`Asistente de reservas de ${businessName}`}
          className={cn(
            "fixed left-3 z-50 flex h-[28rem] max-h-[75vh] w-[calc(100vw-1.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:left-6",
            liftedOnMobile ? "bottom-36 sm:bottom-24" : "bottom-24"
          )}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bot className="size-4" /> Asistente de reservas
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar chat" className="rounded p-1 hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 text-sm">
            {turns.map((t, i) => (
              <div key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2",
                    t.role === "user" ? "bg-foreground text-background" : "bg-muted text-foreground"
                  )}
                >
                  {t.text}
                </div>
              </div>
            ))}
            {sending && <div className="px-1 text-xs text-muted-foreground">Escribiendo…</div>}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-center gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
              placeholder="Escribí tu mensaje…"
              aria-label="Mensaje"
              className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Enviar"
              className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Cerrar asistente de reservas" : "Abrir asistente de reservas"}
        className={cn(
          "fixed left-5 z-40 flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-105 active:scale-95 sm:left-6 sm:bottom-6",
          liftedOnMobile ? "bottom-20" : "bottom-5"
        )}
      >
        <Bot className="size-6" />
      </button>
    </>
  );
}
