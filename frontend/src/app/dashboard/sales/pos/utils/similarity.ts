/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * String Similarity Detection Utilities for POS System
 *
 * This file provides string similarity comparison functions used primarily
 * for detecting duplicate or similar category names during category creation.
 *
 * Uses the Levenshtein distance algorithm to calculate similarity between strings.
 *
 * Extracted from: ManagementView.tsx (lines 1073-1162)
 */

/**
 * Interface for POS Category (minimal definition needed for similarity checks)
 */
export interface POSCategory {
  id: number;
  name: string;
  [key: string]: any; // Allow other properties
}

/**
 * Result of similarity check between a new category name and existing categories
 */
export interface SimilarityResult {
  type: 'exact' | 'similar' | null;
  category: POSCategory | null;
  similarity: number;
}

/**
 * Calculate similarity between two strings using normalized Levenshtein distance
 *
 * The Levenshtein distance measures the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to change one string into another.
 *
 * This function normalizes the result to return a similarity score between 0 and 1:
 * - 1.0 = Identical strings
 * - 0.75-0.99 = Very similar (likely typos or minor variations)
 * - 0.5-0.74 = Somewhat similar
 * - 0.0-0.49 = Different strings
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Similarity score between 0 (completely different) and 1 (identical)
 *
 * @example
 * calculateSimilarity("Printing", "Printing") // Returns 1.0 (exact match)
 * calculateSimilarity("Printing", "Printng") // Returns ~0.89 (likely typo)
 * calculateSimilarity("Print", "Design") // Returns ~0.17 (different words)
 * calculateSimilarity("  PAPER  ", "paper") // Returns 1.0 (normalized)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  // Normalize both strings:
  // 1. Convert to lowercase for case-insensitive comparison
  // 2. Trim whitespace from both ends
  // 3. Remove all internal spaces for space-insensitive comparison
  const s1 = str1.toLowerCase().trim().replace(/\s+/g, '');
  const s2 = str2.toLowerCase().trim().replace(/\s+/g, '');

  // Quick check: if strings are identical after normalization, return perfect match
  if (s1 === s2) return 1.0;

  // Initialize the Levenshtein distance matrix
  // Matrix dimensions: (s2.length + 1) × (s1.length + 1)
  const matrix: number[][] = [];

  // Initialize first column (0 to s2.length)
  // Represents cost of inserting all characters of s2
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row (0 to s1.length)
  // Represents cost of inserting all characters of s1
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix using dynamic programming
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        // Characters match - no operation needed, copy diagonal value
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        // Characters don't match - take minimum of three operations + 1:
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // Substitution (replace character)
          matrix[i][j - 1] + 1, // Insertion (add character)
          matrix[i - 1][j] + 1, // Deletion (remove character)
        );
      }
    }
  }

  // The bottom-right cell contains the final Levenshtein distance
  const distance = matrix[s2.length][s1.length];

  // Normalize the distance to a similarity score (0 to 1)
  // Formula: 1 - (distance / max_length)
  // - If distance = 0, similarity = 1.0 (identical)
  // - If distance = max_length, similarity = 0.0 (completely different)
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - distance / maxLen;
}

/**
 * Find duplicate or similar category in existing categories list
 *
 * This function checks if a new category name conflicts with existing categories.
 * It performs two levels of checking:
 *
 * 1. **Exact Match**: Case-insensitive, space-insensitive exact match
 *    - "Business Cards" matches "business cards", "BusinessCards", " BUSINESS  CARDS "
 *
 * 2. **Similar Match**: Uses Levenshtein distance with 75% threshold
 *    - "Bussiness Cards" (typo) would be flagged as similar to "Business Cards"
 *    - Helps prevent accidental duplicates from typos or variations
 *
 * @param categoryName - The new category name to check
 * @param existingCategories - Array of existing categories to check against
 * @returns Object with match type, matching category, and similarity score
 *
 * @example
 * const categories = [
 *   { id: 1, name: "Business Cards" },
 *   { id: 2, name: "Brochures" }
 * ];
 *
 * // Exact match (case-insensitive)
 * findSimilarCategory("business cards", categories)
 * // Returns: { type: 'exact', category: {...}, similarity: 1.0 }
 *
 * // Similar match (likely typo)
 * findSimilarCategory("Bussiness Cards", categories)
 * // Returns: { type: 'similar', category: {...}, similarity: 0.89 }
 *
 * // No match
 * findSimilarCategory("Posters", categories)
 * // Returns: { type: null, category: null, similarity: 0 }
 */
export function findSimilarCategory(
  categoryName: string,
  existingCategories: POSCategory[],
): SimilarityResult {
  // Normalize the input name for comparison
  const inputName = categoryName.toLowerCase().trim();
  const inputNameNoSpaces = inputName.replace(/\s+/g, '');

  // STEP 1: Check for exact match (case-insensitive, space-insensitive)
  // This catches cases like "Business Cards" vs "business cards" vs "BusinessCards"
  const exactMatch = existingCategories.find(
    (cat) => cat.name.toLowerCase().trim().replace(/\s+/g, '') === inputNameNoSpaces,
  );

  if (exactMatch) {
    return {
      type: 'exact',
      category: exactMatch,
      similarity: 1.0,
    };
  }

  // STEP 2: Check for similar matches using Levenshtein distance
  // Threshold: 0.75 (75% similar) - catches common typos and variations
  // Examples that would match at 75%:
  // - "Printing" vs "Printng" (missing 'i')
  // - "Business" vs "Bussiness" (extra 's')
  // - "Card" vs "Cards" (plural variation)
  const SIMILARITY_THRESHOLD = 0.75;
  let mostSimilar: { category: POSCategory; similarity: number } | null = null;

  // Find the most similar category that exceeds the threshold
  for (const category of existingCategories) {
    const similarity = calculateSimilarity(inputName, category.name);

    if (similarity >= SIMILARITY_THRESHOLD) {
      // Keep track of the most similar match
      if (!mostSimilar || similarity > mostSimilar.similarity) {
        mostSimilar = { category, similarity };
      }
    }
  }

  // If we found a similar match, return it
  if (mostSimilar) {
    return {
      type: 'similar',
      category: mostSimilar.category,
      similarity: mostSimilar.similarity,
    };
  }

  // No matches found - the category name is unique
  return {
    type: null,
    category: null,
    similarity: 0,
  };
}

/**
 * Get a user-friendly description of the similarity level
 *
 * @param similarity - Similarity score (0-1)
 * @returns Human-readable description
 *
 * @example
 * getSimilarityDescription(1.0) // "Identical"
 * getSimilarityDescription(0.85) // "Very similar"
 * getSimilarityDescription(0.60) // "Somewhat similar"
 */
export function getSimilarityDescription(similarity: number): string {
  if (similarity >= 0.95) return 'Identical';
  if (similarity >= 0.85) return 'Very similar';
  if (similarity >= 0.75) return 'Quite similar';
  if (similarity >= 0.6) return 'Somewhat similar';
  return 'Slightly similar';
}
