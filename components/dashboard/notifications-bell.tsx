"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications, type BusinessNotification } from "@/lib/notifications-client";
import type { NotificationType } from "@/modules/notifications/service";
import { cn, formatRelativeTime } from "@/lib/utils";

// Color por urgencia, no por tipo puntual: human_required es lo único que
// realmente bloquea a un cliente esperando, así que es el único rojo — el
// resto son "para revisar cuando puedas" (ámbar) o informativas (verde). Ver
// sección 5 del pedido (el ejemplo de UI usa esta misma semántica de color).
const DOT_CLASS: Record<NotificationType, string> = {
  human_required: "bg-red-500",
  booking_pending: "bg-amber-500",
  payment_proof_received: "bg-amber-500",
  ai_limit_reached: "bg-amber-500",
  booking_created: "bg-emerald-500",
  booking_cancelled: "bg-muted-foreground",
};

function NotificationRow({ notification, onRead }: { notification: BusinessNotification; onRead: (id: string) => void }) {
  const unread = !notification.readAt;

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
        unread && "bg-primary/[0.03]"
      )}
    >
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT_CLASS[notification.type])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{notification.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{notification.body}</p>
        <p className="mt-1 text-[11px] text-muted-foreground/80">{formatRelativeTime(notification.createdAt)}</p>
      </div>
      {unread && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-label="No leída" />}
    </div>
  );

  function handleClick() {
    if (unread) onRead(notification.id);
  }

  if (notification.resourceHref) {
    return (
      <Link href={notification.resourceHref} onClick={handleClick} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={handleClick} className="block w-full">
      {content}
    </button>
  );
}

export function NotificationsBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
            <Bell className="size-[1.1rem]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Notificaciones</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" />
              Marcar todas
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Sparkles className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Todo al día</p>
            <p className="text-xs text-muted-foreground">No hay nada que requiera tu atención.</p>
          </div>
        ) : (
          <div className="max-h-96 divide-y divide-border overflow-y-auto">
            {notifications.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} onRead={markAsRead} />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
