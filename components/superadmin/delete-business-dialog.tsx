"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { requestJson } from "@/lib/api-client";

interface DeleteBusinessDialogProps {
  business: { id: string; name: string; ownerEmail: string | null } | null;
  onClose: () => void;
  onDeleted: (name: string) => void;
}

// Borrado definitivo con doble seguro: hay que tipear el nombre exacto. El
// botón deshabilitado es solo comodidad — el servidor vuelve a comparar.
export function DeleteBusinessDialog({ business, onClose, onDeleted }: DeleteBusinessDialogProps) {
  const [typed, setTyped] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTyped("");
    setError(null);
  }, [business?.id]);

  const matches = !!business && typed.trim() === business.name.trim();

  async function confirm() {
    if (!business || !matches) return;
    setPending(true);
    setError(null);
    try {
      await requestJson(`/api/superadmin/empresas/${business.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmName: typed }),
      });
      onDeleted(business.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos borrar la empresa.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={business !== null} onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Borrar empresa</DialogTitle>
          <DialogDescription>
            Se borra <span className="font-medium text-foreground">{business?.name}</span> con todos sus datos (servicios, turnos,
            consultas, sitio, conversaciones, suscripción). No se puede deshacer. La cuenta de usuario
            {business?.ownerEmail ? ` (${business.ownerEmail})` : ""} no se borra: solo pierde el acceso a esta empresa.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="delete-business-name">
            Para confirmar, escribí el nombre exacto: <span className="font-semibold text-foreground">{business?.name}</span>
          </Label>
          <Input
            id="delete-business-name"
            className="mt-2"
            value={typed}
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
            placeholder={business?.name}
          />
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={() => void confirm()} disabled={!matches || pending}>
            {pending && <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />}
            Borrar definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
