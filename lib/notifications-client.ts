"use client";

import * as React from "react";

import { requestJson } from "@/lib/api-client";
import type { NotificationType } from "@/modules/notifications/service";

export interface BusinessNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  resourceHref: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: BusinessNotification[];
  unreadCount: number;
}

const POLL_INTERVAL_MS = 30_000;

// Polling simple (no SSE): el bell icon no necesita ser instantáneo — un
// refresco cada 30s alcanza para "centro de operaciones" sin sumar una
// segunda infraestructura de tiempo real además de la que ya existe para
// WhatsApp (ver lib/whatsapp-store.tsx, EventSource — específica de esa
// conexión, no genérica para reusar acá).
export function useNotifications() {
  const [data, setData] = React.useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(() => {
    requestJson<NotificationsResponse>("/api/business/notifications")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    reload();
    const interval = setInterval(reload, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reload]);

  const markAsRead = React.useCallback(async (id: string) => {
    setData((prev) =>
      prev
        ? {
            unreadCount: Math.max(0, prev.unreadCount - (prev.notifications.find((n) => n.id === id)?.readAt ? 0 : 1)),
            notifications: prev.notifications.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)),
          }
        : prev
    );
    try {
      await requestJson(`/api/business/notifications/${id}`, { method: "PATCH" });
    } catch {
      reload();
    }
  }, [reload]);

  const markAllAsRead = React.useCallback(async () => {
    setData((prev) =>
      prev
        ? { unreadCount: 0, notifications: prev.notifications.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) }
        : prev
    );
    try {
      await requestJson("/api/business/notifications/read-all", { method: "POST" });
    } catch {
      reload();
    }
  }, [reload]);

  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unreadCount ?? 0,
    loading,
    markAsRead,
    markAllAsRead,
  };
}
