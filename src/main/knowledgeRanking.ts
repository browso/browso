export interface RankableKnowledgePage {
  id: string;
  url: string;
  title: string;
  text: string;
  selection: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface RankedKnowledgePage extends RankableKnowledgePage {
  score: number;
  excerpt: string;
}

export function rankKnowledgePages<T extends RankableKnowledgePage>(
  pages: T[],
  query: string,
): Array<T & { score: number; excerpt: string }> {
  const terms = tokenize(query);
  if (terms.length === 0) {
    return [];
  }

  return pages
    .map((page) => {
      const title = page.title.toLowerCase();
      const url = page.url.toLowerCase();
      const note = page.note.toLowerCase();
      const body = `${page.selection} ${page.text}`.toLowerCase();
      const score = terms.reduce((total, term) => {
        return (
          total +
          countOccurrences(title, term) * 8 +
          countOccurrences(note, term) * 6 +
          countOccurrences(url, term) * 3 +
          Math.min(countOccurrences(body, term), 5)
        );
      }, 0);

      return {
        ...page,
        score,
        excerpt: buildExcerpt(page, terms),
      };
    })
    .filter((page) => page.score > 0)
    .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
}

function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9_-]{1,}/g)
        ?.filter((term) => term.length > 2) ?? [],
    ),
  );
}

function countOccurrences(value: string, term: string): number {
  let count = 0;
  let index = value.indexOf(term);
  while (index >= 0) {
    count += 1;
    index = value.indexOf(term, index + term.length);
  }
  return count;
}

function buildExcerpt(page: RankableKnowledgePage, terms: string[]): string {
  const text = (page.selection || page.note || page.text)
    .replace(/\s+/g, " ")
    .trim();
  const lower = text.toLowerCase();
  const firstIndex = terms.reduce((best, term) => {
    const index = lower.indexOf(term);
    return index >= 0 && (best < 0 || index < best) ? index : best;
  }, -1);
  const start = Math.max(0, firstIndex - 120);
  return text.slice(start, start + 500);
}
