"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { BusinessRole } from "@/modules/business/current";

// Rol del usuario en el negocio actual, resuelto en el servidor
// (app/dashboard/layout.tsx) y disponible para la navegación. Es solo para
// mostrar/ocultar entradas: el control real está en las rutas de API
// (getCurrentBusinessId({ minRole })).
const BusinessRoleContext = createContext<BusinessRole>("owner");

export function BusinessRoleProvider({ role, children }: { role: BusinessRole; children: ReactNode }) {
  return <BusinessRoleContext.Provider value={role}>{children}</BusinessRoleContext.Provider>;
}

export function useBusinessRole(): BusinessRole {
  return useContext(BusinessRoleContext);
}

const RANK: Record<BusinessRole, number> = { member: 1, admin: 2, owner: 3 };
export function roleAllows(role: BusinessRole, minRole: BusinessRole | undefined) {
  return !minRole || RANK[role] >= RANK[minRole];
}
