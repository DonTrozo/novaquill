export class RequestBodyError extends Error {
  constructor(public status: number) { super(status === 413 ? "Request too large" : "Invalid JSON"); }
}

// Enforce the actual stream length; Content-Length alone is not trustworthy.
export async function readLimitedJson(request: Request, maximum: number): Promise<unknown> {
  const claimed = Number(request.headers.get("content-length"));
  if (Number.isFinite(claimed) && claimed > maximum) throw new RequestBodyError(413);
  if (!request.body) throw new RequestBodyError(400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new RequestBodyError(413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let position = 0;
  for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.length; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new RequestBodyError(400); }
}

export async function readLimitedFormData(request: Request, maximum: number): Promise<FormData> {
  const claimed = Number(request.headers.get("content-length"));
  if (Number.isFinite(claimed) && claimed > maximum) throw new RequestBodyError(413);
  if (!request.body) throw new RequestBodyError(400);
  let size = 0;
  const bounded = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      size += chunk.byteLength;
      if (size > maximum) throw new RequestBodyError(413);
      controller.enqueue(chunk);
    },
  }));
  try { return await new Response(bounded, { headers: request.headers }).formData(); }
  catch { throw new RequestBodyError(size > maximum ? 413 : 400); }
}
