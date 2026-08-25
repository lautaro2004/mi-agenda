import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { AvatarValidationError, removeUserAvatar, replaceUserAvatar } from "@/modules/account/avatar";

// userId sale SIEMPRE de la sesión, nunca del body — mismo criterio que
// getCurrentBusinessId(): un usuario no puede tocar el avatar de otro
// cambiando un id desde el cliente.
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el archivo enviado." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const url = await replaceUserAvatar(session.user.id, { bytes, mimeType: file.type, size: file.size });
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof AvatarValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[api/account/avatar] Error al subir el archivo:", error);
    return NextResponse.json({ error: "No pudimos subir el archivo. Intentá de nuevo." }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    await removeUserAvatar(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/account/avatar] Error al eliminar el archivo:", error);
    return NextResponse.json({ error: "No pudimos eliminar el archivo. Intentá de nuevo." }, { status: 500 });
  }
}
