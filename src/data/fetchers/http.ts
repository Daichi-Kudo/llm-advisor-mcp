/** HTTP helpers for bounded upstream fetch parsing. */

export async function readResponseText(
  response: Response,
  maxBytes: number,
  label: string
): Promise<string> {
  assertContentLengthWithinLimit(response, maxBytes, label);

  if (!response.body) {
    const contentLength = response.headers.get("content-length");
    if (!contentLength) {
      throw new Error(`${label} response has no readable body and no content-length header`);
    }
    const text = await response.text();
    assertTextWithinLimit(text, maxBytes, label);
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  let overflow = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        overflow = true;
        throw new Error(`${label} response exceeded ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    if (overflow) {
      try { await reader.cancel(); } catch { /* ignore cancellation error */ }
    }
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function readResponseJson<T>(
  response: Response,
  maxBytes: number,
  label: string
): Promise<T> {
  return JSON.parse(await readResponseText(response, maxBytes, label)) as T;
}

function assertContentLengthWithinLimit(
  response: Response,
  maxBytes: number,
  label: string
): void {
  const contentLength = response.headers.get("content-length");
  if (!contentLength) return;
  const parsed = Number(contentLength);
  if (Number.isFinite(parsed) && parsed > maxBytes) {
    throw new Error(`${label} response too large: ${parsed} bytes`);
  }
}

function assertTextWithinLimit(text: string, maxBytes: number, label: string): void {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > maxBytes) {
    throw new Error(`${label} response exceeded ${maxBytes} bytes`);
  }
}
