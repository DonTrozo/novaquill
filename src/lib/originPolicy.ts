/** Accept only the serving origin or explicitly configured origins. */
export function allowedRequestOrigin(request: Request, configured: string[], development = false): boolean {
  const value = request.headers.get("origin");
  if (!value) return true;
  try {
    const origin = new URL(value);
    if (!['http:', 'https:'].includes(origin.protocol) || value !== origin.origin) return false;
    if (origin.origin === new URL(request.url).origin) return true;
    if (development && origin.hostname === 'localhost') return true;
    return configured.some((entry) => {
      const candidate = entry.trim();
      if (!candidate) return false;
      try {
        // Host-only entries inherit the request scheme; full URLs compare scheme too.
        const parsed = new URL(candidate.includes('://') ? candidate : `${origin.protocol}//${candidate}`);
        return parsed.origin === origin.origin;
      } catch { return false; }
    });
  } catch { return false; }
}
