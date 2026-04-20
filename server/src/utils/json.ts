/**
 * Safely parse JSON that may be truncated by LLM output limits.
 *
 * Strategy: try full parse first. If it fails, find the outermost `{` and its
 * matching `}` (respecting nesting and quoted strings), then parse that substring.
 * Returns null if no valid JSON object can be extracted.
 */
export function safeJsonParse<T = unknown>(raw: string | undefined | null): T | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    // Fall through to extraction
  }

  const start = raw.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]!;

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}
