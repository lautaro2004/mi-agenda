"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { requestJson } from "@/lib/api-client";
import type { TrainingPlan } from "@/lib/types";
import type { TrainingMode } from "@/modules/employee/training/engine";
import type { TrainingProposal } from "@/modules/employee/training/proposal";

interface ChatMessage {
  role: "owner" | "ai";
  text: string;
}

interface ChatError {
  message: string;
  retry: () => void;
}

const OPENING: Record<TrainingMode, string> = {
  onboarding:
    "¡Hola! Soy quien te va a ayudar a configurar tu negocio charlando un rato, nada de formularios largos. Para arrancar: ¿a qué se dedica tu negocio y cómo se llama?",
  continuous: "¡Hola! ¿Qué querés enseñarme o actualizar hoy?",
};

export function TrainingChat({
  mode,
  onProposalApplied,
}: {
  mode: TrainingMode;
  onProposalApplied?: (plan: TrainingPlan | null) => void;
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const [proposal, setProposal] = React.useState<TrainingProposal | null>(null);
  const [chatError, setChatError] = React.useState<ChatError | null>(null);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // El historial vive en el servidor (TrainingConversation/TrainingMessage),
  // no en el estado del navegador: al montar, se retoma la conversación
  // donde quedó en vez de arrancar de cero cada vez que se recarga la página
  // o se cambia de pestaña.
  React.useEffect(() => {
    requestJson<{ messages: ChatMessage[] }>(`/api/ai-studio/training/chat?mode=${mode}`)
      .then(({ messages: history }) => {
        setMessages(history.length > 0 ? history : [{ role: "ai", text: OPENING[mode] }]);
      })
      .catch(() => setMessages([{ role: "ai", text: OPENING[mode] }]))
      .finally(() => setLoadingHistory(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, proposal, chatError]);

  async function sendTurn(text: string) {
    setSending(true);
    setChatError(null);

    try {
      const result = await requestJson<{ reply: string; proposal: TrainingProposal | null }>(
        "/api/ai-studio/training/chat",
        { method: "POST", body: JSON.stringify({ mode, message: text }) }
      );
      setMessages((prev) => [...prev, { role: "ai", text: result.reply }]);
      setProposal(result.proposal);
    } catch (error) {
      setChatError({
        message: error instanceof Error ? error.message : "No pudimos enviar el mensaje. ¿Querés reintentar?",
        retry: () => void sendTurn(text),
      });
    } finally {
      setSending(false);
    }
  }

  function turn(text: string) {
    setMessages((prev) => [...prev, { role: "owner", text }]);
    setProposal(null);
    void sendTurn(text);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    turn(text);
  }

  async function saveProposal() {
    if (!proposal) return;
    setSending(true);
    setChatError(null);

    try {
      // El servidor aplica la propuesta y devuelve, en la misma respuesta, el
      // siguiente turno de la IA y el plan actualizado — así ni la
      // conversación ni el panel lateral quedan esperando otra interacción.
      const result = await requestJson<{
        reply: string;
        proposal: TrainingProposal | null;
        plan: TrainingPlan | null;
      }>("/api/ai-studio/training/apply", {
        method: "POST",
        body: JSON.stringify({ proposal, mode }),
      });
      toast.success("Cambio guardado");
      setMessages((prev) => [
        ...prev,
        { role: "owner", text: "Sí, guardalo así." },
        { role: "ai", text: result.reply },
      ]);
      setProposal(result.proposal);
      onProposalApplied?.(result.plan);
    } catch (error) {
      setChatError({
        message: error instanceof Error ? error.message : "No pudimos guardar esta información. ¿Querés reintentar?",
        retry: () => void saveProposal(),
      });
    } finally {
      setSending(false);
    }
  }

  function handleCancel() {
    setProposal(null);
    turn("No, cancelá ese cambio.");
  }

  function handleEdit() {
    setProposal(null);
    setInput("Quiero ajustar lo anterior: ");
    inputRef.current?.focus();
  }

  return (
    <div className="flex h-[32rem] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {loadingHistory ? (
          <div className="space-y-3">
            <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-muted/60" />
            <div className="ml-auto h-10 w-1/2 animate-pulse rounded-2xl bg-muted/40" />
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "owner" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
                    m.role === "owner" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {proposal && (
              <div className="ml-1 max-w-[80%] rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <Badge variant="secondary">Propuesta</Badge>
                <p className="mt-2 text-sm text-foreground">{proposal.summary}</p>
                <div className="mt-3 flex gap-2">
                  <Button type="button" size="sm" onClick={() => void saveProposal()} disabled={sending}>
                    Guardar
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={handleEdit} disabled={sending}>
                    Editar
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={handleCancel} disabled={sending}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {chatError && (
              <div className="ml-1 max-w-[80%] rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm text-destructive">{chatError.message}</p>
                <div className="mt-3 flex gap-2">
                  <Button type="button" size="sm" onClick={() => chatError.retry()} disabled={sending}>
                    Reintentar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setChatError(null)}
                    disabled={sending}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Pensando...
                </div>
              </div>
            )}
          </>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2 border-t border-border pt-4">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribí tu respuesta..."
          disabled={sending || loadingHistory}
        />
        <Button type="submit" size="icon" disabled={sending || loadingHistory || !input.trim()} aria-label="Enviar">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
