"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Send, ThumbsDown, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { requestJson } from "@/lib/api-client";

interface SimMessage {
  role: "customer" | "ai";
  text: string;
  feedback?: "correct" | "incorrect";
  edited?: boolean;
  originalText?: string;
  askSaveCorrection?: boolean;
}

export function SimulatorChat() {
  const [messages, setMessages] = React.useState<SimMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editText, setEditText] = React.useState("");
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    const historySnapshot = messages.map(({ role, text }) => ({ role, text }));
    setMessages((prev) => [...prev, { role: "customer", text }]);
    setSending(true);

    try {
      const { reply } = await requestJson<{ reply: string }>("/api/ai-studio/simulator/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, history: historySnapshot }),
      });
      setMessages((prev) => [...prev, { role: "ai", text: reply }]);
    } catch {
      toast.error("No pudimos enviar el mensaje. Intentá de nuevo.");
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send();
  }

  function setFeedback(index: number, feedback: "correct" | "incorrect") {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, feedback } : m)));
  }

  function startEdit(index: number) {
    setEditingIndex(index);
    setEditText(messages[index].text);
  }

  function saveEdit(index: number) {
    const newText = editText.trim();
    if (!newText) return;

    setMessages((prev) =>
      prev.map((m, i) =>
        i === index
          ? { ...m, text: newText, edited: true, originalText: m.originalText ?? m.text, askSaveCorrection: true }
          : m
      )
    );
    setEditingIndex(null);
    setEditText("");
  }

  function dismissCorrectionPrompt(index: number) {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, askSaveCorrection: false } : m)));
  }

  async function saveCorrection(index: number) {
    const message = messages[index];
    const customerMessage = index > 0 ? messages[index - 1].text : "";

    try {
      await requestJson("/api/ai-studio/simulator/correction", {
        method: "POST",
        body: JSON.stringify({
          customerMessage,
          originalReply: message.originalText ?? message.text,
          correctedReply: message.text,
        }),
      });
      toast.success("Corrección guardada en la memoria del negocio");
    } catch {
      toast.error("No pudimos guardar la corrección.");
    } finally {
      dismissCorrectionPrompt(index);
    }
  }

  return (
    <div className="flex h-[32rem] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Escribí un mensaje como si fueras un cliente para probar cómo responde tu empleado. Usa exactamente
            el mismo motor que WhatsApp, pero nada de lo que pase acá afecta datos reales.
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex flex-col", m.role === "customer" ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
                m.role === "customer" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              )}
            >
              {m.text}
              {m.edited && <span className="ml-2 text-xs opacity-70">(editada)</span>}
            </div>

            {m.role === "ai" && editingIndex !== i && (
              <div className="mt-1 flex items-center gap-1">
                <Button
                  type="button"
                  variant={m.feedback === "correct" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setFeedback(i, "correct")}
                  aria-label="Marcar como correcta"
                >
                  <ThumbsUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant={m.feedback === "incorrect" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setFeedback(i, "incorrect")}
                  aria-label="Marcar como incorrecta"
                >
                  <ThumbsDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => startEdit(i)}
                  aria-label="Editar respuesta"
                >
                  <Pencil className="size-3.5" />
                </Button>
              </div>
            )}

            {m.role === "ai" && editingIndex === i && (
              <div className="mt-2 w-full max-w-[80%] space-y-2">
                <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} autoFocus />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => saveEdit(i)}>
                    Guardar cambio
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingIndex(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {m.role === "ai" && m.askSaveCorrection && (
              <div className="mt-2 max-w-[80%] rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                <p className="text-foreground">
                  ¿Querés guardar esta corrección para que el empleado responda así en el futuro?
                </p>
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" onClick={() => void saveCorrection(i)}>
                    Guardar como memoria
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => dismissCorrectionPrompt(i)}>
                    No, gracias
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Pensando...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2 border-t border-border pt-4">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribí como si fueras un cliente..."
          disabled={sending}
        />
        <Button type="submit" size="icon" disabled={sending || !input.trim()} aria-label="Enviar">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
