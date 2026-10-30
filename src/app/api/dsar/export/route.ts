import { decryptBuffer } from "@/lib/crypto";
import { recordSecurityEvent } from "@/lib/securityAudit";
import { decryptSignatureDataUrl } from "@/lib/signatureStorage";
import { rateLimitOk } from "@/lib/guard";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!(await rateLimitOk(`account:export:${user.id}`, 5, 60_000))) return new Response("Rate limit", { status: 429 });
  const signatures = await prisma.savedSignature.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const docs = await prisma.document.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, filename: true, createdAt: true, size: true, mimeType: true },
  });
  const payments = await prisma.payfastEvent.findMany({
    where: { OR: [{ payload: { path: ["userId"], equals: user.id } }, { payload: { path: ["custom_str1"], equals: user.id } }] },
    select: { pfPaymentId: true, createdAt: true, payload: true }, orderBy: { createdAt: "desc" },
  });
  const requests = await prisma.privacyRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const securityEvents = await prisma.securityEvent.findMany({ where: { actorId: user.id }, orderBy: { createdAt: "desc" } });
  // Scale-friendly export: include metadata + authenticated download URLs (avoid embedding bytes).
  const payload = {
    user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, image: user.image, createdAt: user.createdAt, subscription: user.subscription, subscriptionPlan: user.subscriptionPlan, docsUsedThisMonth: user.docsUsedThisMonth, usageYearMonth: user.usageYearMonth, lastPaymentAt: user.lastPaymentAt, lastPaymentReference: user.payfastLastPaymentId },
    payments: payments.map((payment) => {
      const info = payment.payload && typeof payment.payload === "object" && !Array.isArray(payment.payload) ? payment.payload : {};
      return { reference: payment.pfPaymentId, createdAt: payment.createdAt, status: info.paymentStatus ?? info.payment_status, amountCents: info.grossAmountCents, amountGross: info.amount_gross, currency: info.currency ?? info.currency_code, plan: info.plan ?? info.custom_str2 };
    }),
    privacyRequests: requests.map((item) => ({ id: item.id, kind: item.kind, message: decryptBuffer(Buffer.from(item.encryptedMessage), true).toString("utf8"), contactEmail: item.encryptedContact ? decryptBuffer(Buffer.from(item.encryptedContact), true).toString("utf8") : null, status: item.status, createdAt: item.createdAt, resolvedAt: item.resolvedAt, notifiedAt: item.notifiedAt, outcome: item.encryptedOutcome ? JSON.parse(decryptBuffer(Buffer.from(item.encryptedOutcome), true).toString("utf8")) : null })),
    securityEvents,
    savedSignatures: signatures.map((signature) => ({ id: signature.id, name: signature.name, createdAt: signature.createdAt, dataUrl: decryptSignatureDataUrl(Buffer.from(signature.encryptedPayload)) })),
    documents: docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      mimeType: d.mimeType,
      size: d.size,
      createdAt: d.createdAt,
      downloadUrl: `/api/documents/${d.id}`,
    })),
  };
  await recordSecurityEvent("account.exported", user.id);
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=export.json" },
  });
}



