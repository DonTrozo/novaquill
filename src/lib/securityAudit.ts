import { prisma } from "@/lib/prisma";

type Action = "document.read" | "document.denied" | "document.stored" | "document.deleted" | "signature.listed" | "signature.saved.explicit-v1" | "signature.deleted" | "signature.denied" | "account.exported" | "account.deleted" | "privacy.requested" | "privacy.resolved";

export async function recordSecurityEvent(action: Action, actorId: string | null, targetId?: string, digest?: string) {
  // Fixed fields keep sensitive payloads and arbitrary request text out of the audit log.
  await prisma.securityEvent.create({ data: { action, actorId, targetId: targetId?.slice(0, 128), digest } });
}
