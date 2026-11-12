"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { requireOwner } from "./auth";
import { sessionSchema, settingsSchema, subjectSchema } from "./validation";
import { slugify } from "./format";
import { z } from "zod";
import { Prisma } from "@prisma/client";
const refresh = () => {
  for (const path of [
    "/",
    "/activity",
    "/subjects",
    "/manage",
    "/manage/sessions",
    "/manage/subjects",
    "/manage/analytics",
    "/manage/settings",
  ])
    revalidatePath(path);
};
const safeErrors = new Set([
  "Unauthorized",
  "Change your temporary password before using your workspace.",
  "Subject not found",
  "Archive this subject to preserve its study history",
  "Session not found",
  "Choose an active subject",
  "Finish the current timer first",
  "No timer is active",
  "Timer has stopped",
  "Stop the timer before saving",
  "Study for at least one second",
]);
function fail(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    return { ok: false as const, error: "A record with that name already exists." };
  return {
    ok: false as const,
    error:
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid input")
        : error instanceof Error && safeErrors.has(error.message)
          ? error.message
          : "Could not complete this action. Please try again.",
  };
}
export async function saveSubject(input: unknown, id?: string) {
  try {
    const owner = await requireOwner();
    const data = subjectSchema.parse(input);
    if (id) {
      const subject = await prisma.subject.findFirst({
        where: { id, ownerId: owner.id },
      });
      if (!subject) throw new Error("Subject not found");
      const slug =
        data.name === subject.name ? subject.slug : slugify(data.name);
      await prisma.subject.update({ where: { id }, data: { ...data, slug } });
    } else
      await prisma.subject.create({
        data: { ...data, ownerId: owner.id, slug: slugify(data.name) },
      });
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
export async function archiveSubject(id: string, archived: boolean) {
  try {
    const owner = await requireOwner();
    const row = await prisma.subject.updateMany({
      where: { id, ownerId: owner.id },
      data: { isArchived: archived },
    });
    if (!row.count) throw new Error("Subject not found");
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
export async function deleteSubject(id: string) {
  try {
    const owner = await requireOwner();
    const subject = await prisma.subject.findFirst({
      where: { id, ownerId: owner.id },
      include: { _count: { select: { sessions: true } } },
    });
    if (!subject) throw new Error("Subject not found");
    if (subject._count.sessions)
      throw new Error("Archive this subject to preserve its study history");
    await prisma.subject.delete({ where: { id } });
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
export async function saveSession(input: unknown, id?: string) {
  try {
    const owner = await requireOwner();
    const data = sessionSchema.parse(input);
    const existing = id
      ? await prisma.studySession.findFirst({
          where: { id, ownerId: owner.id },
        })
      : null;
    if (id && !existing) throw new Error("Session not found");
    const subject = await prisma.subject.findFirst({
      where: { id: data.subjectId, ownerId: owner.id },
    });
    if (!subject || (subject.isArchived && existing?.subjectId !== subject.id))
      throw new Error("Choose an active subject");
    const durationSeconds = Math.max(
      1,
      Math.round((data.endedAt.getTime() - data.startedAt.getTime()) / 1000),
    );
    if (id) {
      await prisma.studySession.update({
        where: { id },
        data: {
          ...data,
          durationSeconds,
          idempotencyKey: existing!.idempotencyKey,
        },
      });
    } else
      await prisma.studySession.create({
        data: { ...data, ownerId: owner.id, durationSeconds },
      });
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
export async function deleteSession(id: string) {
  try {
    const owner = await requireOwner();
    const row = await prisma.studySession.deleteMany({
      where: { id, ownerId: owner.id },
    });
    if (!row.count) throw new Error("Session not found");
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
export async function saveSettings(input: unknown) {
  try {
    const owner = await requireOwner();
    const data = settingsSchema.parse(input);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: owner.id },
        data: {
          username: data.username,
          displayName: data.displayName,
          biography: data.biography,
          studyGoal: data.studyGoal,
          avatarUrl: data.avatarUrl || null,
        },
      }),
      prisma.userSettings.upsert({
        where: { ownerId: owner.id },
        create: {
          ownerId: owner.id,
          timezone: data.timezone,
          profileVisibility: data.profileVisibility,
          themePreference: data.themePreference,
        },
        update: {
          timezone: data.timezone,
          profileVisibility: data.profileVisibility,
          themePreference: data.themePreference,
        },
      }),
      prisma.studyGoal.upsert({
        where: { ownerId: owner.id },
        create: {
          ownerId: owner.id,
          dailyTargetMinutes: data.dailyTargetMinutes,
        },
        update: { dailyTargetMinutes: data.dailyTargetMinutes },
      }),
    ]);
    refresh();
    revalidatePath(`/u/${owner.username}`, "layout");
    revalidatePath(`/u/${data.username}`, "layout");
    return { ok: true as const, username: data.username };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return { ok: false as const, error: "That username is already taken." };
    return fail(error);
  }
}
export async function startTimer(input: unknown) {
  try {
    const owner = await requireOwner();
    const data = z
      .object({
        subjectId: z.string().min(1),
        title: z.string().trim().min(1).max(160),
      })
      .parse(input);
    const subject = await prisma.subject.findFirst({
      where: { id: data.subjectId, ownerId: owner.id, isArchived: false },
    });
    if (!subject) throw new Error("Choose an active subject");
    const previous = await prisma.timerState.findUnique({
      where: { ownerId: owner.id },
    });
    if (previous) throw new Error("Finish the current timer first");
    const now = new Date();
    await prisma.timerState.create({
      data: {
        ownerId: owner.id,
        subjectId: data.subjectId,
        title: data.title,
        startedAt: now,
        runningSince: now,
        saveKey: crypto.randomUUID(),
      },
    });
    revalidatePath("/manage");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
export async function toggleTimer() {
  try {
    const owner = await requireOwner();
    const row = await prisma.timerState.findUnique({
      where: { ownerId: owner.id },
    });
    if (!row) throw new Error("No timer is active");
    const now = new Date();
    if (row.status === "running" && row.runningSince)
      await prisma.timerState.update({
        where: { ownerId: owner.id },
        data: {
          status: "paused",
          elapsedSeconds:
            row.elapsedSeconds +
            Math.floor((now.getTime() - row.runningSince.getTime()) / 1000),
          runningSince: null,
        },
      });
    else if (row.status === "paused")
      await prisma.timerState.update({
        where: { ownerId: owner.id },
        data: { status: "running", runningSince: now },
      });
    else throw new Error("Timer has stopped");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
export async function stopTimer() {
  try {
    const owner = await requireOwner();
    const row = await prisma.timerState.findUnique({
      where: { ownerId: owner.id },
    });
    if (!row) throw new Error("No timer is active");
    if (row.status === "stopped") return { ok: true as const };
    const now = new Date();
    await prisma.timerState.update({
      where: { ownerId: owner.id },
      data: {
        status: "stopped",
        stoppedAt: now,
        elapsedSeconds:
          row.elapsedSeconds +
          (row.runningSince
            ? Math.floor((now.getTime() - row.runningSince.getTime()) / 1000)
            : 0),
        runningSince: null,
      },
    });
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
export async function saveTimer(isPublic: boolean, notes = "") {
  try {
    const owner = await requireOwner();
    const row = await prisma.timerState.findUnique({
      where: { ownerId: owner.id },
    });
    if (!row || row.status !== "stopped")
      throw new Error("Stop the timer before saving");
    if (row.elapsedSeconds < 1)
      throw new Error("Study for at least one second");
    const endedAt = row.stoppedAt ?? new Date();
    await prisma.$transaction(async (tx) => {
      await tx.studySession.upsert({
        where: { idempotencyKey: row.saveKey },
        create: {
          ownerId: owner.id,
          subjectId: row.subjectId,
          title: row.title,
          notes: notes.slice(0, 5000),
          startedAt: row.startedAt,
          endedAt,
          durationSeconds: row.elapsedSeconds,
          isPublic,
          idempotencyKey: row.saveKey,
        },
        update: {},
      });
      await tx.timerState.deleteMany({ where: { ownerId: owner.id, saveKey: row.saveKey } });
    });
    refresh();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
export async function discardTimer() {
  try {
    const owner = await requireOwner();
    await prisma.timerState.deleteMany({ where: { ownerId: owner.id } });
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
