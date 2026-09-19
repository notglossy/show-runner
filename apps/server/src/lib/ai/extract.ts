/** Pulls the screen fragment out of a model reply. Returns null when the reply contains no HTML. */
export function extractHtml(reply: string): string | null {
  const text = reply.replaceAll('\r\n', '\n');
  const lines = text.split('\n');
  let lastHtml: string | null = null;
  let lastAny: string | null = null;
  let open: { info: string; buf: string[] } | null = null;
  const flush = () => {
    if (!open) return;
    const content = open.buf.join('\n').trim();
    lastAny = content;
    if (isHtmlInfo(open.info)) lastHtml = content;
    open = null;
  };
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (open) flush();
      else open = { info: line.slice(3).trim(), buf: [] };
    } else if (open) open.buf.push(line);
  }
  // Unterminated fence (truncated reply): only an html one counts.
  if (open && isHtmlInfo(open.info)) lastHtml = open.buf.join('\n').trim();
  const picked = lastHtml ?? lastAny;
  if (picked !== null) return picked === '' ? null : picked;
  const trimmed = text.trim();
  if (trimmed.startsWith('<') && trimmed !== '') return trimmed;
  return null;
}

/** First word of the fence info string is "html" (case-insensitive). */
function isHtmlInfo(info: string): boolean {
  const first = info.split(/\s+/, 1)[0] ?? '';
  return first.toLowerCase() === 'html';
}
