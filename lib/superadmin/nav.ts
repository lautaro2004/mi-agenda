import { Bot, Building2, CreditCard, LayoutDashboard } from "lucide-react";

export const SUPERADMIN_NAV = [
  { href: "/superadmin", label: "Resumen", icon: LayoutDashboard },
  { href: "/superadmin/empresas", label: "Empresas", icon: Building2 },
  { href: "/superadmin/ia", label: "Uso de IA", icon: Bot },
  { href: "/superadmin/planes", label: "Planes", icon: CreditCard },
] as const;
