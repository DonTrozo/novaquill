import { privacyNotice } from "@/lib/privacyNotice";
export async function GET() {
  // Explicit allowlist: no secret values, provider credentials or private evidence returned.
  return Response.json(privacyNotice());
}
