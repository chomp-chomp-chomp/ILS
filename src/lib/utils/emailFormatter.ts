/**
 * Email formatting utilities for sharing catalog records
 */

export interface RecordForEmail {
	id: string;
	title: string;
	author?: string;
	shortUrl?: string;
}

/**
 * Generate short URLs for multiple records
 */
export async function generateShortUrls(recordIds: string[], origin: string): Promise<Map<string, string>> {
	const shortUrls = new Map<string, string>();

	// Generate short URLs in parallel
	const promises = recordIds.map(async (id) => {
		const fullUrl = `${origin}/catalog/record/${id}`;

		try {
			const response = await fetch('/api/shorten', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fullUrl,
					resourceType: 'record',
					resourceId: id
				})
			});

			if (response.ok) {
				const data = await response.json();
				shortUrls.set(id, data.shortUrl);
			} else {
				// Fallback to full URL if short URL creation fails
				shortUrls.set(id, fullUrl);
			}
		} catch (error) {
			console.error(`Failed to create short URL for ${id}:`, error);
			shortUrls.set(id, fullUrl);
		}
	});

	await Promise.all(promises);
	return shortUrls;
}

/**
 * Format multiple records for email (minimal format)
 */
export function formatRecordsEmail(
	records: RecordForEmail[],
	searchUrl?: string
): { subject: string; body: string } {
	const subject = `Library Catalog - ${records.length} Selected Item${records.length === 1 ? '' : 's'}`;

	let body = `━━━ Selected Records ━━━\n\n`;

	records.forEach((record, index) => {
		body += `${index + 1}. ${record.title}\n`;
		if (record.author) {
			body += `   ${record.author}\n`;
		}
		body += `   ${record.shortUrl || 'URL not available'}\n\n`;
	});

	if (searchUrl) {
		body += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
		body += `View search results:\n${searchUrl}\n\n`;
	}

	body += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
	body += `Browse catalog: ${typeof window !== 'undefined' ? window.location.origin : ''}/catalog`;

	return { subject, body };
}

/**
 * Format single record for email (rich format)
 */
export function formatSingleRecordEmail(record: {
	title: string;
	author?: string;
	isbn?: string;
	publisher?: string;
	year?: string;
	call_number?: string;
	location?: string;
	status?: string;
	shortUrl: string;
}): { subject: string; body: string } {
	const subject = `${record.title} - Library Catalog`;

	let body = `━━━ Catalog Record ━━━\n\n`;
	body += `Title: ${record.title}\n`;

	if (record.author) {
		body += `Author: ${record.author}\n`;
	}

	if (record.isbn) {
		body += `ISBN: ${record.isbn}\n`;
	}

	if (record.publisher) {
		body += `Publisher: ${record.publisher}`;
		if (record.year) {
			body += `, ${record.year}`;
		}
		body += `\n`;
	}

	body += `\n`;

	if (record.call_number) {
		body += `Call Number: ${record.call_number}\n`;
	}

	if (record.location) {
		body += `Location: ${record.location}\n`;
	}

	if (record.status) {
		const statusIcon = record.status === 'available' ? '✅' : '❌';
		body += `Status: ${statusIcon} ${record.status.charAt(0).toUpperCase() + record.status.slice(1)}\n`;
	}

	body += `\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
	body += `View full details:\n${record.shortUrl}\n\n`;
	body += `Questions? Visit: ${typeof window !== 'undefined' ? window.location.origin : ''}/catalog`;

	return { subject, body };
}

/**
 * Open mailto: link with formatted email
 */
export function openMailto(subject: string, body: string) {
	const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

	// Check if body is too long (conservative limit: 1800 chars)
	if (body.length > 1800) {
		console.warn('Email body may be too long for some email clients');
	}

	window.location.href = mailtoUrl;
}

/**
 * Calculate approximate character count for email
 */
export function estimateEmailSize(records: RecordForEmail[]): number {
	// Approximate: ~120 chars per record + headers/footers (~200 chars)
	return records.length * 120 + 200;
}

/**
 * Check if selection fits within mailto: limits
 */
export function canFitInEmail(recordCount: number): { fits: boolean; maxRecords: number } {
	const charLimit = 1800; // Conservative limit
	const charsPerRecord = 120;
	const overhead = 200;

	const maxRecords = Math.floor((charLimit - overhead) / charsPerRecord);
	const fits = recordCount <= maxRecords;

	return { fits, maxRecords };
}
