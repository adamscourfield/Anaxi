"use server";
import { assertSafeServerAction } from "@/lib/serverActionGuard";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUserOrThrow } from "@/lib/auth";
import { avatarUploadErrorMessage, readAvatarFile } from "@/lib/avatarUpload";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateOwnAvatar(formData: FormData): Promise<ActionResult> {
  try {
    await assertSafeServerAction(formData);
    const user = await getSessionUserOrThrow();

    if (String(formData.get("remove")) === "true") {
      await (prisma as any).user.update({
        where: { id: user.id },
        data: { avatarImage: null, avatarMimeType: null, avatarUpdatedAt: null },
      });
      revalidatePath("/profile");
      return { ok: true };
    }

    const file = formData.get("avatar");
    if (!(file instanceof File)) throw new Error("EMPTY_FILE");
    const { bytes, mimeType } = await readAvatarFile(file);

    await (prisma as any).user.update({
      where: { id: user.id },
      data: { avatarImage: bytes, avatarMimeType: mimeType, avatarUpdatedAt: new Date() },
    });
    revalidatePath("/profile");
    return { ok: true };
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    return { ok: false, error: avatarUploadErrorMessage(code) };
  }
}
