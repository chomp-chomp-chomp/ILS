<script lang="ts">
	import { onMount } from 'svelte';

	// State management
	let mode = $state<'good' | 'random' | 'ionesco'>('good');
	let count = $state(5);
	let format = $state<'paragraphs' | 'sentences'>('paragraphs');
	let generatedText = $state('');
	let copied = $state(false);

	// Dad Jokes - "Good" Mode
	const goodJokes = [
		"I'm reading a book about anti-gravity. It's impossible to put down.",
		"I used to be a banker, but I lost interest.",
		"I don't trust stairs. They're always up to something.",
		"I got fired from the calendar factory. I took too many days off.",
		"I'm on a seafood diet. I see food and I eat it.",
		"I tried to catch fog yesterday. Mist.",
		"I used to hate facial hair, but then it grew on me.",
		"I once had a fear of hurdles, but I got over it.",
		"I'm afraid for the calendar. Its days are numbered.",
		"I don't play soccer because I enjoy the sport. I'm just doing it for kicks.",
		"I told my wife she was drawing her eyebrows too high. She looked surprised.",
		"I asked my dog what's two minus two. He said nothing.",
		"I can't believe I got fired from the keyboard factory. All I did was press the space bar.",
		"I used to play piano by ear, but now I use my hands.",
		"I bought some shoes from a drug dealer. I don't know what he laced them with, but I was tripping all day.",
		"I used to be addicted to soap, but I'm clean now.",
		"I'm reading a book about glue. I can't seem to put it down.",
		"I don't trust atoms. They make up everything.",
		"I stayed up all night wondering where the sun went. Then it dawned on me.",
		"I tried to learn origami, but I folded.",
		"I used to work in a bakery, but I couldn't make enough dough.",
		"I don't trust elevators. I take steps to avoid them.",
		"I once worked at a shoe recycling shop. It was sole destroying.",
		"I tried writing with a broken pencil. It was pointless.",
		"I used to be afraid of math, but I figured it out.",
		"I'm reading a book about teleportation. It's bound to take me places.",
		"I tried to be a watchmaker, but I couldn't find the time.",
		"I don't like jokes about construction. I'm still working on them.",
		"I used to be a gardener, but I didn't grow into it.",
		"I tried to learn sign language, but it didn't speak to me.",
		"I'm reading a book on the history of glue. It sticks with you.",
		"I used to be a photographer, but I couldn't focus.",
		"I don't trust people who do math in their head. They're too calculating.",
		"I used to work at a calendar store, but I got fired for taking days off.",
		"I tried to learn how to ice skate, but I kept falling for it.",
		"I once worked in a recycling plant. It was a lot of reprocessing.",
		"I used to be a carpenter, but I couldn't nail it down.",
		"I tried to be a musician, but I couldn't find my tempo.",
		"I don't trust clocks. They're always ticking.",
		"I tried to read a book on the history of elevators. It had its ups and downs.",
		"I once worked at a paper factory. It was tearable work.",
		"I tried to learn how to juggle, but I dropped it.",
		"I used to be a tailor, but I couldn't make the cut.",
		"I once worked at a clock store. Time flew by.",
		"I tried to learn chess, but I couldn't see the point.",
		"I don't trust scissors. They're always cutting corners.",
		"I once worked at a zoo, but I couldn't bear it.",
		"I tried to learn calligraphy, but my handwriting couldn't commit.",
		"I used to be a baker, but I couldn't rise to the occasion.",
		"I don't trust balloons. They're always full of hot air.",
		"I tried to learn pottery, but it didn't pan out.",
		"I used to be a gardener, but I didn't have the thyme.",
		"I don't trust fences. They're always on the line.",
		"I tried to learn karate, but I couldn't make a kick out of it.",
		"I used to be a librarian, but I was overdue.",
		"I don't trust bakers before noon. They're always half-baked.",
		"I once worked at a battery factory. I was charged all day.",
		"I tried to learn photography, but I couldn't develop it.",
		"I used to be a roofer, but I lost my shingles.",
		"I once worked at a carpet store. It was a lot of floor work.",
		"I tried to learn fencing, but I kept getting the point.",
		"I once worked at a map company. I lost my bearings.",
		"I tried to learn baking bread, but I couldn't knead it.",
		"I used to be a tour guide, but I lost the group."
	];

	// Ionesco Mode
	const ionescoJokes = [
		"I checked the clock to see if it was still time, and it was.",
		"The chair was moved slightly, and that was enough.",
		"I opened the window, and the room noticed.",
		"The calendar confirmed the day, which stayed where it was.",
		"I adjusted the light until it matched the situation.",
		"The door closed the way doors close.",
		"I checked the weather, and it continued.",
		"The table remained between us.",
		"I looked for the remote, and it was near the usual place.",
		"The room stayed the same while I was in it.",
		"I turned the knob, and the stove responded normally.",
		"The instructions were still written down.",
		"I checked the schedule, and it remained scheduled.",
		"The floor held its position.",
		"I moved the mug closer, and it stayed closer.",
		"The light switch did what it does.",
		"I checked the drawer, and it contained what it contained.",
		"The sound came from where the sound was.",
		"I straightened the paper, and it stayed straightened.",
		"The clock moved forward without comment.",
		"I opened the door to see if it would open, and it did.",
		"The room looked the same from over here as well.",
		"I lowered the volume until it was lower.",
		"The window allowed air in its usual amount.",
		"I checked the label, and it stayed attached.",
		"The chair supported its purpose.",
		"I adjusted the table, and the table adjusted accordingly.",
		"The calendar stayed on the wall.",
		"I checked the light again, and it was still light.",
		"The instructions did not change while I read them.",
		"I looked at the clock again, and it continued being a clock.",
		"The door remained closed after closing.",
		"The room was ready when we were.",
		"Everything was where it had been.",
		"That part was settled.",
		"I moved the paper slightly, and it became slightly moved.",
		"The handle stayed in place.",
		"The surface was clean enough to continue.",
		"I checked the corner, and the corner was there.",
		"The lamp stayed on.",
		"I straightened the stack, and it stayed stacked.",
		"The window stayed open until it was closed.",
		"I checked the shelf, and it held what it was holding.",
		"The room remained available.",
		"Nothing required further adjustment.",
		"I stood back, and it looked as expected.",
		"I checked the clock, and it continued as expected.",
		"The chair stayed where it was after being moved.",
		"I opened the window, and the outside stayed outside.",
		"The calendar showed the day without elaboration.",
		"I adjusted the light, and the room accepted it.",
		"The door closed without incident.",
		"I checked the weather, and it remained underway.",
		"The table stayed in place between things.",
		"I looked at the remote, and it was still a remote.",
		"The room did not change while I was looking at it.",
		"I turned the knob, and the stove stayed cooperative.",
		"The instructions remained readable.",
		"I checked the schedule, and it did not object.",
		"The floor continued supporting us.",
		"I moved the mug, and it stayed moved.",
		"The switch stayed switched.",
		"I checked the drawer, and it contained what it contained.",
		"The sound stayed where the sound was.",
		"I straightened the paper again, and it remained paper.",
		"The clock continued moving in one direction.",
		"The door stayed closed after that.",
		"The room appeared ready.",
		"Everything stayed manageable.",
		"That part required no further comment.",
		"It remained in order.",
		"I checked the clock once again, and it continued doing so.",
		"The chair remained usable after being used.",
		"I opened the window briefly, and the room stayed a room.",
		"The calendar stayed visible without further explanation.",
		"I adjusted the light slightly, and the brightness adjusted with it.",
		"The door stayed closed until it wasn't.",
		"I checked the weather once more, and it persisted.",
		"The table continued serving its purpose.",
		"I moved the mug a little, and it stayed there.",
		"The instructions remained legible throughout.",
		"I checked the schedule again, and it was still scheduled.",
		"The floor stayed firm underfoot.",
		"I turned the switch, and the switch complied.",
		"The room remained arranged.",
		"Everything stayed as expected.",
		"That was sufficient."
	];

	// Random mode - word pools for generation
	const setups = [
		"I fixed the {NOUN_A}",
		"I read a book about {NOUN_A}",
		"I tried {VERB_A} the {NOUN_A}",
		"I followed the {NOUN_A}",
		"I checked the {NOUN_A}",
		"I bought a {NOUN_A}",
		"I made a {NOUN_A}",
		"I asked the {NOUN_A} for {NOUN_B}",
		"I replaced the {NOUN_A}"
	];

	const connectors = ["but", "and", "so", "which", "then", "until", "because", "while", "even though"];

	const endings = [
		", and that was {NOUN_END}.",
		", and nothing improved.",
		", and the {NOUN_END} won.",
		", and I called it {NOUN_END}.",
		", and it stayed {ADJ_END}.",
		", and that was my {NOUN_END}.",
		", and we agreed to disagree."
	];

	const adjEnd = [
		"available", "incorrect", "seasonal", "calibrated", "miscellaneous", "overdue",
		"conclusive", "quiet", "loud", "final", "temporary", "unhelpful", "remarkable"
	];

	const adverbs = [
		"quietly", "politely", "briefly", "anyway", "again", "sideways", "exactly", "accidentally",
		"immediately", "eventually", "overnight", "by mistake", "on purpose", "for no reason",
		"in theory", "in practice", "at scale", "as usual", "in silence", "with confidence",
		"without warning", "for compliance", "for clarity", "for safety", "for speed", "for reasons",
		"for the record", "to be fair", "strictly speaking", "as requested", "on paper"
	];

	const verbs = [
		"fixed", "read", "followed", "checked", "organized", "opened", "closed", "cleaned", "removed",
		"approved", "labeled", "sorted", "archived", "assigned", "audited", "balanced", "banned",
		"blamed", "blessed", "booked", "boxed", "buffered", "calibrated", "cataloged", "circled",
		"classified", "compiled", "confirmed", "contradicted", "copied", "corrected", "crated",
		"cropped", "deferred", "deleted", "denied", "docked", "drafted", "echoed", "edited", "emailed",
		"enabled", "erased", "estimated", "exported", "flagged", "flattened", "flipped", "folded",
		"forwarded", "froze", "graded", "grounded", "halted", "handled", "highlighted", "indexed",
		"inspected", "installed", "joined", "launched", "leaked", "logged", "looped", "masked",
		"measured", "merged", "muted", "named", "noted", "numbered", "packed", "paused", "pinned",
		"printed", "processed", "published", "queued", "rated", "rebooted", "recorded", "reduced",
		"refunded", "renamed", "repaired", "replaced", "rerouted", "reset", "reshelved", "retried"
	];

	const nouns = [
		"clock", "instructions", "manual", "recipe", "calendar", "time", "weather", "email", "drawer",
		"printer", "pen", "list", "map", "doorbell", "silence", "floor", "ladder", "sandwich", "bread",
		"alphabet", "reason", "problem", "number", "meeting", "confidence", "receipt", "window", "chair",
		"mug", "kettle", "toaster", "oven", "pan", "lid", "sponge", "towel", "soap", "key", "lock", "hinge",
		"screw", "tape", "string", "cord", "charger", "battery", "remote", "lamp", "blanket", "pillow",
		"shelf", "box", "basket", "jar", "bottle", "cap", "ticket", "envelope", "stamp", "form", "memo",
		"invoice", "clipboard", "binder", "folder", "tab", "appendix", "footnote", "index", "glossary",
		"deadline", "agenda", "minutes", "policy", "protocol", "procedure", "workflow", "approval",
		"signature", "margin", "draft", "revision", "version", "attachment", "plan", "idea", "mood",
		"tone", "noise", "pressure", "focus", "patience", "context", "meaning", "summary", "priority",
		"solution", "tradeoff", "assumption", "promise", "rumor", "pattern", "signal", "error", "warning",
		"cache", "cookie", "token", "variable", "endpoint", "server", "log", "queue", "buffer", "patch",
		"update", "backup", "file", "database", "schema", "query", "filter", "result", "password", "barcode",
		"catalog", "record", "hold", "fine", "stack", "call number", "spine", "label", "due date", "reference",
		"circulation", "subject", "heading", "entry", "edition"
	];

	const nounPrefix = ["the", "a", "my", "your", "this", "that", "one", "another", "spare", "wrong", "final", "second", "new", "old", "same"];

	// Anti-repetition buffers
	let recentNouns: string[] = $state([]);
	let recentVerbs: string[] = $state([]);
	let recentAdverbs: string[] = $state([]);

	const RECENT_NOUNS_WINDOW = 20;
	const RECENT_VERBS_WINDOW = 18;
	const RECENT_ADVERBS_WINDOW = 10;

	// Helper functions for random generation
	function random<T>(arr: T[]): T {
		return arr[Math.floor(Math.random() * arr.length)];
	}

	function chooseFresh<T>(pool: T[], recent: T[], tries = 12): T {
		for (let i = 0; i < tries; i++) {
			const candidate = random(pool);
			if (!recent.includes(candidate)) {
				return candidate;
			}
		}
		return random(pool);
	}

	function pushRecent<T>(queue: T[], item: T, maxLen: number): void {
		queue.push(item);
		if (queue.length > maxLen) {
			queue.shift();
		}
	}

	function maybePrefix(noun: string): string {
		return Math.random() < 0.35 ? `${random(nounPrefix)} ${noun}` : noun;
	}

	function pickNoun(used: Set<string>): string {
		for (let i = 0; i < 14; i++) {
			const n = chooseFresh(nouns, recentNouns);
			if (!used.has(n)) {
				pushRecent(recentNouns, n, RECENT_NOUNS_WINDOW);
				used.add(n);
				return maybePrefix(n);
			}
		}
		const n = random(nouns);
		pushRecent(recentNouns, n, RECENT_NOUNS_WINDOW);
		used.add(n);
		return maybePrefix(n);
	}

	function pickVerb(): string {
		const v = chooseFresh(verbs, recentVerbs);
		pushRecent(recentVerbs, v, RECENT_VERBS_WINDOW);
		return v;
	}

	function maybeAdverbTag(): string {
		if (Math.random() < 0.50) {
			const adv = chooseFresh(adverbs, recentAdverbs);
			pushRecent(recentAdverbs, adv, RECENT_ADVERBS_WINDOW);
			return ` ${adv}`;
		}
		return '';
	}

	function swapVerb(originalVerb: string): string {
		if (Math.random() < 0.80) {
			return pickVerb();
		}
		return originalVerb;
	}

	function generateRandomSentence(): string {
		const used = new Set<string>();

		// Setup
		const setupTemplate = random(setups);
		const nounA = pickNoun(used);
		const nounB = pickNoun(used);
		const verbA = pickVerb();

		let setup = setupTemplate
			.replace('{NOUN_A}', nounA)
			.replace('{NOUN_B}', nounB)
			.replace('{VERB_A}', verbA);

		const connector = random(connectors);

		// Tail clauses (1-4)
		const clauseCount = Math.random() < 0.15 ? 1 : Math.random() < 0.50 ? 2 : Math.random() < 0.85 ? 3 : 4;

		const clauses: string[] = [];

		// Clause 1
		const v1 = pickVerb();
		const n1 = pickNoun(used);
		clauses.push(`${v1} the ${n1}`);

		if (clauseCount >= 2) {
			const v2 = swapVerb(v1);
			const n2 = pickNoun(used);
			clauses.push(`${v2} the ${n2}`);
		}

		if (clauseCount >= 3) {
			const v3 = swapVerb(pickVerb());
			const n3 = pickNoun(used);
			clauses.push(`and ${v3} the ${n3}`);
		}

		if (clauseCount >= 4) {
			const v4 = swapVerb(pickVerb());
			const n4 = pickNoun(used);
			clauses.push(`and ${v4} the ${n4}`);
		}

		const punct = [', ', '; ', ' — ', ': '];
		const sep = random(punct);
		const tailCore = ` ${connector} ${clauses.join(sep)}`;

		// Ending
		let tailEnd: string;
		if (Math.random() < 0.55) {
			const tmpl = random(endings);
			const endN = pickNoun(used);
			const adj = random(adjEnd);
			tailEnd = tmpl.replace('{NOUN_END}', endN).replace('{ADJ_END}', adj);
		} else {
			const endN = pickNoun(used);
			tailEnd = `, and kept the ${endN}.`;
		}

		const tailTag = maybeAdverbTag();

		let sentence = setup + tailCore + tailEnd;
		sentence = sentence.replace(/\.$/, '') + tailTag + '.';

		return sentence;
	}

	function generateText(): void {
		let text = '';
		const sentences: string[] = [];

		if (mode === 'good') {
			// Generate from good jokes pool
			for (let i = 0; i < count; i++) {
				const shuffled = [...goodJokes].sort(() => Math.random() - 0.5);
				if (format === 'paragraphs') {
					const sentCount = Math.floor(Math.random() * 3) + 6; // 6-8 sentences
					const para = shuffled.slice(0, sentCount).join(' ');
					sentences.push(para);
				} else {
					sentences.push(...shuffled.slice(0, count));
					break;
				}
			}
		} else if (mode === 'ionesco') {
			// Generate from ionesco pool
			for (let i = 0; i < count; i++) {
				const shuffled = [...ionescoJokes].sort(() => Math.random() - 0.5);
				if (format === 'paragraphs') {
					const sentCount = Math.floor(Math.random() * 3) + 6; // 6-8 sentences
					const para = shuffled.slice(0, sentCount).join(' ');
					sentences.push(para);
				} else {
					sentences.push(...shuffled.slice(0, count));
					break;
				}
			}
		} else if (mode === 'random') {
			// Generate random dad jokes
			for (let i = 0; i < count; i++) {
				if (format === 'paragraphs') {
					const sentCount = Math.floor(Math.random() * 3) + 6; // 6-8 sentences
					const para: string[] = [];
					for (let j = 0; j < sentCount; j++) {
						para.push(generateRandomSentence());
					}
					sentences.push(para.join(' '));
				} else {
					sentences.push(generateRandomSentence());
				}
			}
		}

		text = format === 'paragraphs'
			? sentences.join('\n\n')
			: sentences.join('\n');

		generatedText = text;
	}

	function copyToClipboard(): void {
		navigator.clipboard.writeText(generatedText).then(() => {
			copied = true;
			setTimeout(() => copied = false, 2000);
		});
	}

	// Generate initial text
	onMount(() => {
		generateText();
	});

	// Regenerate when mode, count, or format changes
	$effect(() => {
		if (mode || count || format) {
			generateText();
		}
	});
</script>

<svelte:head>
	<title>Dad Jokes Ipsum - The joke makes more sense if you don't think about it</title>
	<meta name="description" content="Generate placeholder text using dad jokes in three delightful flavors: Good, Random, and Ionesco" />
</svelte:head>

<div class="ipsum-container">
	<!-- Hero Section - PLACEHOLDER -->
	<div class="hero-placeholder">
		<h1 class="hero-title">Dad Jokes Ipsum</h1>
		<p class="hero-subtitle">The joke makes more sense if you don't think about it.</p>
		<!-- TODO: Add hero image here -->
	</div>

	<div class="content-wrapper">
		<!-- Controls Section -->
		<div class="controls-card">
			<div class="control-section">
				<label class="control-label">Select Your Dad:</label>
				<div class="button-group">
					<button
						class="mode-button {mode === 'good' ? 'active' : ''}"
						onclick={() => mode = 'good'}
					>
						Normal Dad
					</button>
					<button
						class="mode-button {mode === 'random' ? 'active' : ''}"
						onclick={() => mode = 'random'}
					>
						Random Dad
					</button>
					<button
						class="mode-button {mode === 'ionesco' ? 'active' : ''}"
						onclick={() => mode = 'ionesco'}
					>
						Ionesco Dad
					</button>
				</div>
			</div>

			<div class="control-section">
				<label class="control-label" for="format-select">Format:</label>
				<select id="format-select" bind:value={format} class="select-input">
					<option value="paragraphs">Paragraphs</option>
					<option value="sentences">Sentences</option>
				</select>
			</div>

			<div class="control-section">
				<label class="control-label" for="count-input">
					Number of {format}:
				</label>
				<input
					id="count-input"
					type="number"
					min="1"
					max="50"
					bind:value={count}
					class="number-input"
				/>
			</div>

			<button class="btn-generate" onclick={generateText}>
				🎲 Generate New Text
			</button>
		</div>

		<!-- Generated Text Display -->
		<div class="output-card">
			<div class="output-header">
				<h2 class="output-title">Generated Dad Jokes</h2>
				<button
					class="btn-copy {copied ? 'copied' : ''}"
					onclick={copyToClipboard}
					disabled={!generatedText}
				>
					{copied ? '✓ Copied!' : '📋 Copy'}
				</button>
			</div>

			<div class="output-text">
				{#if generatedText}
					{generatedText}
				{:else}
					<p class="placeholder-text">Click "Generate New Text" to create your dad jokes...</p>
				{/if}
			</div>
		</div>

		<!-- Info Section -->
		<div class="info-card">
			<h3>About the Dads</h3>
			<dl class="dad-descriptions">
				<dt>Normal Dad</dt>
				<dd>Classic dad jokes with traditional pun structures. These are the jokes your actual dad would tell at barbecues.</dd>

				<dt>Random Dad</dt>
				<dd>AI-generated absurdist dad jokes with unpredictable structures. Logic is optional, earnestness is mandatory.</dd>

				<dt>Ionesco Dad</dt>
				<dd>Existential dad jokes inspired by the theater of the absurd. Everything happens, nothing changes, it's all very normal.</dd>
			</dl>
		</div>

		<!-- TODO: Add to ipsum dropdown menu (location: ?) -->
		<!-- TODO: Add to ipsum tools page (location: ?) -->
	</div>
</div>

<style>
	.ipsum-container {
		min-height: 100vh;
		background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
	}

	.hero-placeholder {
		background: linear-gradient(135deg, rgba(231, 59, 66, 0.9), rgba(102, 126, 234, 0.9));
		color: white;
		text-align: center;
		padding: 4rem 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		position: relative;
		overflow: hidden;
	}

	.hero-placeholder::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" font-size="60" opacity="0.1">👨</text></svg>') repeat;
		background-size: 100px 100px;
		opacity: 0.1;
	}

	.hero-title {
		font-size: 3rem;
		font-weight: 700;
		margin: 0 0 1rem 0;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
		position: relative;
		z-index: 1;
	}

	.hero-subtitle {
		font-size: 1.5rem;
		margin: 0;
		font-weight: 300;
		font-style: italic;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
		position: relative;
		z-index: 1;
	}

	.content-wrapper {
		max-width: 1200px;
		margin: 0 auto;
		padding: 3rem 2rem;
		display: grid;
		gap: 2rem;
	}

	.controls-card,
	.output-card,
	.info-card {
		background: white;
		border-radius: 12px;
		padding: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
	}

	.control-section {
		margin-bottom: 1.5rem;
	}

	.control-label {
		display: block;
		font-weight: 600;
		color: #2c3e50;
		margin-bottom: 0.5rem;
		font-size: 1rem;
	}

	.button-group {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.mode-button {
		flex: 1;
		min-width: 140px;
		padding: 1rem 1.5rem;
		border: 2px solid #e0e0e0;
		background: white;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		color: #666;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.mode-button:hover {
		border-color: #667eea;
		color: #667eea;
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(102, 126, 234, 0.2);
	}

	.mode-button.active {
		background: linear-gradient(135deg, #667eea, #764ba2);
		color: white;
		border-color: transparent;
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.select-input,
	.number-input {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		font-size: 1rem;
		transition: border-color 0.2s;
	}

	.select-input:focus,
	.number-input:focus {
		outline: none;
		border-color: #667eea;
	}

	.btn-generate {
		width: 100%;
		padding: 1rem 2rem;
		background: linear-gradient(135deg, #e73b42, #ff6b72);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1.125rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		margin-top: 1rem;
	}

	.btn-generate:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(231, 59, 66, 0.4);
	}

	.output-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.output-title {
		margin: 0;
		font-size: 1.5rem;
		color: #2c3e50;
	}

	.btn-copy {
		padding: 0.5rem 1.5rem;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-copy:hover:not(:disabled) {
		background: #5568d3;
		transform: translateY(-1px);
	}

	.btn-copy.copied {
		background: #2ecc71;
	}

	.btn-copy:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.output-text {
		background: #f8f9fa;
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		padding: 1.5rem;
		font-family: 'Georgia', serif;
		font-size: 1rem;
		line-height: 1.8;
		color: #333;
		min-height: 300px;
		white-space: pre-wrap;
	}

	.placeholder-text {
		color: #999;
		font-style: italic;
		text-align: center;
		margin: 3rem 0;
	}

	.info-card h3 {
		margin: 0 0 1.5rem 0;
		color: #2c3e50;
		font-size: 1.5rem;
	}

	.dad-descriptions {
		margin: 0;
	}

	.dad-descriptions dt {
		font-weight: 700;
		color: #667eea;
		margin-top: 1rem;
		font-size: 1.125rem;
	}

	.dad-descriptions dt:first-child {
		margin-top: 0;
	}

	.dad-descriptions dd {
		margin: 0.5rem 0 0 0;
		color: #666;
		line-height: 1.6;
		padding-left: 1.5rem;
	}

	@media (max-width: 768px) {
		.hero-title {
			font-size: 2rem;
		}

		.hero-subtitle {
			font-size: 1.125rem;
		}

		.content-wrapper {
			padding: 2rem 1rem;
		}

		.controls-card,
		.output-card,
		.info-card {
			padding: 1.5rem;
		}

		.button-group {
			flex-direction: column;
		}

		.mode-button {
			min-width: 100%;
		}

		.output-header {
			flex-direction: column;
			gap: 1rem;
			align-items: stretch;
		}

		.btn-copy {
			width: 100%;
		}
	}
</style>
