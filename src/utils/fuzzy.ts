export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Checks if query fuzzily matches the target string.
 * It first checks for a direct substring match.
 * If that fails and the query is long enough, it uses Levenshtein distance.
 */
export function fuzzyMatch(query: string, target: string, maxDistance: number = 2): boolean {
  const q = query.trim().toLowerCase();
  const t = target.trim().toLowerCase();

  if (q.length === 0) return true;
  if (t.includes(q)) return true;

  // For very short queries, don't fuzzy match to avoid returning almost everything
  if (q.length <= 2) return false;

  // We can check if any word in the target is a fuzzy match to the query, 
  // or just check the whole target.
  const distance = levenshteinDistance(q, t);
  if (distance <= maxDistance) return true;

  // Also check individual words in target if target has multiple words
  const targetWords = t.split(/[\s-]+/);
  if (targetWords.length > 1) {
    for (const word of targetWords) {
      if (word.length > 2 && levenshteinDistance(q, word) <= maxDistance) {
        return true;
      }
    }
  }

  return false;
}
