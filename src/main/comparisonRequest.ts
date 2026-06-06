export interface ComparisonRequest {
  left: string;
  right: string;
}

export function extractComparisonRequest(
  message: string,
): ComparisonRequest | null {
  const trimmed = message
    .trim()
    .replace(/^[\s,]*(please|can you|could you)\s+/i, "")
    .replace(/[?!.\s]+$/g, "")
    .replace(/\s+(for me|side by side|please)\s*$/i, "");

  if (!trimmed) {
    return null;
  }

  const patterns = [
    /^\s*compare\s+(?:between\s+)?(.+?)\s+(?:with|and|to|vs\.?|versus)\s+(.+?)\s*$/i,
    /^\s*compare\s+(.+?)\s+(?:with|and|to|vs\.?|versus)\s+(.+?)\s*$/i,
    /^\s*(.+?)\s+(?:vs\.?|versus)\s+(.+?)\s*$/i,
  ] as const;

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    const left = cleanComparisonSubject(match?.[1]);
    const right = cleanComparisonSubject(match?.[2]);
    if (left && right && left.toLowerCase() !== right.toLowerCase()) {
      return { left, right };
    }
  }

  return null;
}

function cleanComparisonSubject(value: string | undefined): string | null {
  const cleaned = value
    ?.trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ");

  if (!cleaned || cleaned.length < 2) {
    return null;
  }

  return cleaned;
}
