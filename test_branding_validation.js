#!/usr/bin/env node

/**
 * Test script for branding API validation
 * Tests the validation logic without requiring authentication
 */

console.log('=== Branding API Validation Tests ===\n');

// Test 1: Hex color validation
console.log('Test 1: Hex Color Validation');
function isValidHexColor(color) {
	if (!color) return true;
	return /^#[0-9A-Fa-f]{6}$/.test(color);
}

const colorTests = [
	{ input: '#e73b42', expected: true, description: 'Valid hex color' },
	{ input: '#FFFFFF', expected: true, description: 'Valid uppercase hex' },
	{ input: '#abc123', expected: true, description: 'Valid mixed case hex' },
	{ input: '#gggggg', expected: false, description: 'Invalid characters' },
	{ input: '#fff', expected: false, description: 'Too short' },
	{ input: '#1234567', expected: false, description: 'Too long' },
	{ input: 'red', expected: false, description: 'Named color' },
	{ input: '', expected: true, description: 'Empty string (allowed)' },
	{ input: null, expected: true, description: 'Null (allowed)' }
];

colorTests.forEach(test => {
	const result = isValidHexColor(test.input);
	const status = result === test.expected ? '✅ PASS' : '❌ FAIL';
	console.log(`  ${status}: ${test.description} - Input: "${test.input}"`);
	if (result !== test.expected) {
		console.log(`    Expected: ${test.expected}, Got: ${result}`);
	}
});

// Test 2: Validation function
console.log('\nTest 2: Branding Data Validation');
function validateBrandingData(body) {
	const errors = [];

	// Validate required field
	if (!body.library_name || body.library_name.trim() === '') {
		errors.push('Library name is required');
	}

	// Validate footer text (if show_powered_by is true, footer_text should not be empty)
	if (body.show_powered_by && (!body.footer_text || body.footer_text.trim() === '')) {
		errors.push('Footer text is required when "show_powered_by" is enabled');
	}

	// Validate color fields
	const colorFields = [
		{ key: 'primary_color', label: 'Primary Color' },
		{ key: 'secondary_color', label: 'Secondary Color' },
		{ key: 'accent_color', label: 'Accent Color' },
		{ key: 'background_color', label: 'Background Color' },
		{ key: 'text_color', label: 'Text Color' }
	];

	for (const field of colorFields) {
		const color = body[field.key];
		if (color && !isValidHexColor(color)) {
			errors.push(`${field.label} must be in hex format (#rrggbb)`);
		}
	}

	// Validate items per page
	if (body.items_per_page !== undefined && body.items_per_page !== null) {
		const itemsPerPage = Number(body.items_per_page);
		if (isNaN(itemsPerPage) || itemsPerPage < 5 || itemsPerPage > 100) {
			errors.push('Items per page must be between 5 and 100');
		}
	}

	// Validate URLs if provided
	const urlFields = ['logo_url', 'homepage_logo_url', 'favicon_url', 'facebook_url', 'twitter_url', 'instagram_url'];
	for (const field of urlFields) {
		const url = body[field];
		if (url && typeof url === 'string' && url.trim() !== '') {
			try {
				new URL(url);
			} catch {
				errors.push(`${field.replace('_', ' ')} must be a valid URL`);
			}
		}
	}

	return errors;
}

const validationTests = [
	{
		description: 'Valid branding data',
		data: {
			library_name: 'Test Library',
			footer_text: 'Powered by Test',
			show_powered_by: true,
			primary_color: '#e73b42',
			items_per_page: 20
		},
		expectedErrors: 0
	},
	{
		description: 'Missing library name',
		data: {
			footer_text: 'Test',
			primary_color: '#e73b42'
		},
		expectedErrors: 1,
		expectedError: 'Library name is required'
	},
	{
		description: 'Empty footer text with show_powered_by enabled',
		data: {
			library_name: 'Test Library',
			show_powered_by: true,
			footer_text: ''
		},
		expectedErrors: 1,
		expectedError: 'Footer text is required'
	},
	{
		description: 'Invalid color format',
		data: {
			library_name: 'Test Library',
			primary_color: 'red'
		},
		expectedErrors: 1,
		expectedError: 'Primary Color must be in hex format'
	},
	{
		description: 'Items per page out of range',
		data: {
			library_name: 'Test Library',
			items_per_page: 200
		},
		expectedErrors: 1,
		expectedError: 'Items per page must be between 5 and 100'
	},
	{
		description: 'Invalid URL',
		data: {
			library_name: 'Test Library',
			logo_url: 'not-a-url'
		},
		expectedErrors: 1,
		expectedError: 'logo url must be a valid URL'
	},
	{
		description: 'Multiple validation errors',
		data: {
			library_name: '',
			primary_color: '#gggggg',
			items_per_page: 3
		},
		expectedErrors: 3
	}
];

validationTests.forEach(test => {
	const errors = validateBrandingData(test.data);
	const status = errors.length === test.expectedErrors ? '✅ PASS' : '❌ FAIL';
	console.log(`  ${status}: ${test.description}`);
	console.log(`    Expected ${test.expectedErrors} errors, got ${errors.length}`);
	if (errors.length > 0) {
		console.log(`    Errors: ${errors.join(', ')}`);
	}
	if (test.expectedError && !errors.some(e => e.includes(test.expectedError))) {
		console.log(`    ⚠️  Expected error containing: "${test.expectedError}"`);
	}
	console.log('');
});

console.log('\n=== All Tests Complete ===');
