"use client";

import { AssetUploader } from "@/components/dashboard/asset-uploader";

interface LogoUploaderProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

// Wrapper fino sobre AssetUploader para no tocar la integración con
// react-hook-form en app/onboarding/negocio/page.tsx (Controller sigue
// viendo el mismo contrato value/onChange). Antes esto guardaba el logo
// como base64 directo en Postgres vía FileReader — ahora sube a Supabase
// Storage igual que el resto de la apariencia (ver sección 3 de la tarea).
export function LogoUploader({ value, onChange }: LogoUploaderProps) {
  return <AssetUploader kind="logo" value={value} onChange={onChange} />;
}
