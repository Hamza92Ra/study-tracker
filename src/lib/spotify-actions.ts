"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireOwner } from "./auth";
import { prisma } from "./db";
import { parseSpotifyUrl } from "./spotify";

function errorMessage(error: unknown) {
  if (error instanceof z.ZodError)
    return error.issues[0]?.message ?? "Invalid input";
  if (error instanceof Error && error.message.startsWith("Use a "))
    return error.message;
  return "Could not update your music. Please try again.";
}
export async function addSpotifyLink(input: unknown) {
  try {
    const owner = await requireOwner();
    const data = z
      .object({ url: z.string(), label: z.string().trim().min(1).max(80) })
      .parse(input);
    const parsed = parseSpotifyUrl(data.url);
    const link = await prisma.spotifyLink.upsert({
      where: {
        ownerId_kind_spotifyId: {
          ownerId: owner.id,
          kind: parsed.kind,
          spotifyId: parsed.id,
        },
      },
      create: {
        ownerId: owner.id,
        kind: parsed.kind,
        spotifyId: parsed.id,
        label: data.label,
      },
      update: { label: data.label },
    });
    await prisma.userSettings.upsert({
      where: { ownerId: owner.id },
      create: { ownerId: owner.id, selectedSpotifyLinkId: link.id },
      update: { selectedSpotifyLinkId: link.id, spotifyWidgetVisible: true },
    });
    revalidatePath("/manage");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}
export async function selectSpotifyLink(input: unknown) {
  try {
    const owner = await requireOwner();
    const id = z.string().min(1).max(128).parse(input);
    const link = await prisma.spotifyLink.findFirst({
      where: { id, ownerId: owner.id },
      select: { id: true },
    });
    if (!link) return { ok: false as const, error: "Playlist not found." };
    await prisma.userSettings.upsert({
      where: { ownerId: owner.id },
      create: { ownerId: owner.id, selectedSpotifyLinkId: id },
      update: { selectedSpotifyLinkId: id },
    });
    revalidatePath("/manage");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}
export async function setSpotifyVisible(input: unknown) {
  try {
    const owner = await requireOwner();
    const visible = z.boolean().parse(input);
    await prisma.userSettings.upsert({
      where: { ownerId: owner.id },
      create: { ownerId: owner.id, spotifyWidgetVisible: visible },
      update: { spotifyWidgetVisible: visible },
    });
    revalidatePath("/manage");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}
export async function removeSpotifyLink(input: unknown) {
  try {
    const owner = await requireOwner();
    const id = z.string().min(1).max(128).parse(input);
    await prisma.$transaction(
      async (tx) => {
        const removed = await tx.spotifyLink.deleteMany({
          where: { id, ownerId: owner.id },
        });
        if (!removed.count) throw new Error("Playlist not found.");
        const settings = await tx.userSettings.findUnique({
          where: { ownerId: owner.id },
          select: { selectedSpotifyLinkId: true },
        });
        if (settings?.selectedSpotifyLinkId === id) {
          const next = await tx.spotifyLink.findFirst({
            where: { ownerId: owner.id },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });
          await tx.userSettings.update({
            where: { ownerId: owner.id },
            data: { selectedSpotifyLinkId: next?.id ?? null },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    revalidatePath("/manage");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}
