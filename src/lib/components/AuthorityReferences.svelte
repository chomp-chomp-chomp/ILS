<script lang="ts">
	/**
	 * Authority References Component
	 *
	 * Displays cross-references for authority headings in search results
	 * Shows "See" and "See also" references
	 */

	interface Props {
		searchTerm: string;
		type?: string;
	}

	let { searchTerm, type }: Props = $props();

	let references = $state<any>(null);
	let loading = $state(false);

	$effect(() => {
		if (searchTerm && searchTerm.length > 2) {
			fetchReferences();
		}
	});

	async function fetchReferences() {
		loading = true;

		try {
			const params = new URLSearchParams({
				heading: searchTerm,
				limit: '1'
			});

			if (type) {
				params.set('type', type);
			}

			const response = await fetch(`/api/authorities/suggest?${params.toString()}`);

			if (!response.ok) throw new Error('Failed to fetch references');

			const data = await response.json();

			if (data.suggestions && data.suggestions.length > 0) {
				const authority = data.suggestions[0];

				// Check if this is an exact match or close variant
				const isExactMatch =
					authority.heading.toLowerCase() === searchTerm.toLowerCase() ||
					authority.variant_forms?.some(
						(v: string) => v.toLowerCase() === searchTerm.toLowerCase()
					);

				if (isExactMatch || authority.similarity_score > 0.8) {
					const crossRefs = authority.authority_cross_refs || [];

					references = {
						heading: authority.heading,
						isVariant:
							!isExactMatch &&
							authority.variant_forms?.some(
								(v: string) => v.toLowerCase() === searchTerm.toLowerCase()
							),
						seeAlso: crossRefs
							.filter((ref: any) => ref.ref_type === 'see_also')
							.map((ref: any) => ref.reference_text)
					};
				}
			}
		} catch (error) {
			console.error('Error fetching authority references:', error);
		} finally {
			loading = false;
		}
	}
</script>

{#if loading}
	<!-- Loading state (minimal) -->
{:else if references}
	<div class="authority-references">
		{#if references.isVariant}
			<!-- This is a variant form - show "See" reference -->
			<div class="see-reference">
				<strong>See:</strong>
				<a href="?q={encodeURIComponent(references.heading)}">
					{references.heading}
				</a>
			</div>
		{/if}

		{#if references.seeAlso && references.seeAlso.length > 0}
			<!-- Show "See also" references -->
			<div class="see-also-reference">
				<strong>See also:</strong>
				{#each references.seeAlso as related, i}
					{#if i > 0}<span class="separator">•</span>{/if}
					<a href="?q={encodeURIComponent(related)}">
						{related}
					</a>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.authority-references {
		background: #e3f2fd;
		border-left: 4px solid #1976d2;
		padding: 12px 16px;
		margin-bottom: 20px;
		border-radius: 4px;
		font-size: 14px;
	}

	.see-reference,
	.see-also-reference {
		margin: 6px 0;
	}

	.see-reference strong,
	.see-also-reference strong {
		color: #1976d2;
		margin-right: 8px;
	}

	.see-reference a,
	.see-also-reference a {
		color: #1565c0;
		text-decoration: none;
		font-weight: 500;
	}

	.see-reference a:hover,
	.see-also-reference a:hover {
		text-decoration: underline;
	}

	.separator {
		margin: 0 8px;
		color: #1976d2;
	}
</style>
