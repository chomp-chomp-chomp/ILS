/**
 * Text normalization utilities for diacritic-insensitive search
 */

/**
 * Remove diacritics from text for search normalization
 * This allows searching for "Zizek" to match "Žižek", etc.
 *
 * Uses the browser's built-in Unicode normalization (NFD) to decompose
 * characters into base + combining diacritic, then removes the diacritics.
 *
 * Example:
 *   removeDiacritics("Žižek") => "Zizek"
 *   removeDiacritics("Café") => "Cafe"
 *   removeDiacritics("Müller") => "Muller"
 */
export function removeDiacritics(text: string): string {
	if (!text) return text;

	// Normalize to NFD (Canonical Decomposition)
	// This separates base characters from combining diacritics
	// Example: "é" becomes "e" + "́" (combining acute accent)
	const normalized = text.normalize('NFD');

	// Remove combining diacritical marks (Unicode range \u0300-\u036f)
	// These are the separate accent characters after NFD normalization
	const withoutDiacritics = normalized.replace(/[\u0300-\u036f]/g, '');

	return withoutDiacritics;
}

/**
 * Normalize a search query by removing diacritics
 * Use this before passing queries to full-text search
 */
export function normalizeSearchQuery(query: string): string {
	return removeDiacritics(query);
}
