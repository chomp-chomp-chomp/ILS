<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';
	import Image from '@tiptap/extension-image';
	import TextAlign from '@tiptap/extension-text-align';
	import Underline from '@tiptap/extension-underline';

	let { value = $bindable(''), placeholder = 'Start typing...' } = $props();

	let element: HTMLElement;
	let editor: Editor;

	onMount(() => {
		editor = new Editor({
			element: element,
			extensions: [
				StarterKit,
				Underline,
				Link.configure({
					openOnClick: false,
					HTMLAttributes: {
						class: 'text-link'
					}
				}),
				Image.configure({
					HTMLAttributes: {
						class: 'content-image'
					}
				}),
				TextAlign.configure({
					types: ['heading', 'paragraph']
				})
			],
			content: value,
			editorProps: {
				attributes: {
					class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[300px] max-w-none p-4'
				}
			},
			onTransaction: () => {
				// Force re-render so `editor.isActive` works as expected
				editor = editor;
			},
			onUpdate: ({ editor }) => {
				value = editor.getHTML();
			}
		});
	});

	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
	});

	function setLink() {
		const previousUrl = editor.getAttributes('link').href;
		const url = window.prompt('URL', previousUrl);

		if (url === null) {
			return;
		}

		if (url === '') {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}

		editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
	}

	function addImage() {
		const url = window.prompt('Image URL');

		if (url) {
			editor.chain().focus().setImage({ src: url }).run();
		}
	}
</script>

<div class="editor-container">
	<div class="menu-bar">
		<div class="menu-group">
			<button
				type="button"
				onclick={() => editor.chain().focus().toggleBold().run()}
				disabled={!editor?.can().chain().focus().toggleBold().run()}
				class:is-active={editor?.isActive('bold')}
				title="Bold"
			>
				<strong>B</strong>
			</button>
			<button
				type="button"
				onclick={() => editor.chain().focus().toggleItalic().run()}
				disabled={!editor?.can().chain().focus().toggleItalic().run()}
				class:is-active={editor?.isActive('italic')}
				title="Italic"
			>
				<em>I</em>
			</button>
			<button
				type="button"
				onclick={() => editor.chain().focus().toggleUnderline().run()}
				disabled={!editor?.can().chain().focus().toggleUnderline().run()}
				class:is-active={editor?.isActive('underline')}
				title="Underline"
			>
				<u>U</u>
			</button>
			<button
				type="button"
				onclick={() => editor.chain().focus().toggleStrike().run()}
				disabled={!editor?.can().chain().focus().toggleStrike().run()}
				class:is-active={editor?.isActive('strike')}
				title="Strikethrough"
			>
				<s>S</s>
			</button>
		</div>

		<div class="menu-divider"></div>

		<div class="menu-group">
			<button
				type="button"
				onclick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
				class:is-active={editor?.isActive('heading', { level: 1 })}
				title="Heading 1"
			>
				H1
			</button>
			<button
				type="button"
				onclick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
				class:is-active={editor?.isActive('heading', { level: 2 })}
				title="Heading 2"
			>
				H2
			</button>
			<button
				type="button"
				onclick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
				class:is-active={editor?.isActive('heading', { level: 3 })}
				title="Heading 3"
			>
				H3
			</button>
			<button
				type="button"
				onclick={() => editor.chain().focus().setParagraph().run()}
				class:is-active={editor?.isActive('paragraph')}
				title="Paragraph"
			>
				P
			</button>
		</div>

		<div class="menu-divider"></div>

		<div class="menu-group">
			<button
				type="button"
				onclick={() => editor.chain().focus().toggleBulletList().run()}
				class:is-active={editor?.isActive('bulletList')}
				title="Bullet List"
			>
				• List
			</button>
			<button
				type="button"
				onclick={() => editor.chain().focus().toggleOrderedList().run()}
				class:is-active={editor?.isActive('orderedList')}
				title="Numbered List"
			>
				1. List
			</button>
			<button
				type="button"
				onclick={() => editor.chain().focus().toggleBlockquote().run()}
				class:is-active={editor?.isActive('blockquote')}
				title="Blockquote"
			>
				"
			</button>
		</div>

		<div class="menu-divider"></div>

		<div class="menu-group">
			<button
				type="button"
				onclick={() => editor.chain().focus().setTextAlign('left').run()}
				class:is-active={editor?.isActive({ textAlign: 'left' })}
				title="Align Left"
			>
				⇤
			</button>
			<button
				type="button"
				onclick={() => editor.chain().focus().setTextAlign('center').run()}
				class:is-active={editor?.isActive({ textAlign: 'center' })}
				title="Align Center"
			>
				⇥
			</button>
			<button
				type="button"
				onclick={() => editor.chain().focus().setTextAlign('right').run()}
				class:is-active={editor?.isActive({ textAlign: 'right' })}
				title="Align Right"
			>
				⇥
			</button>
		</div>

		<div class="menu-divider"></div>

		<div class="menu-group">
			<button
				type="button"
				onclick={setLink}
				class:is-active={editor?.isActive('link')}
				title="Add Link"
			>
				🔗 Link
			</button>
			<button type="button" onclick={addImage} title="Add Image"> 🖼️ Image </button>
		</div>

		<div class="menu-divider"></div>

		<div class="menu-group">
			<button
				type="button"
				onclick={() => editor.chain().focus().undo().run()}
				disabled={!editor?.can().chain().focus().undo().run()}
				title="Undo"
			>
				↶
			</button>
			<button
				type="button"
				onclick={() => editor.chain().focus().redo().run()}
				disabled={!editor?.can().chain().focus().redo().run()}
				title="Redo"
			>
				↷
			</button>
		</div>
	</div>

	<div bind:this={element} class="editor-content"></div>
</div>

<style>
	.editor-container {
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		overflow: hidden;
		background: white;
	}

	.menu-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.75rem;
		background: #f8f9fa;
		border-bottom: 1px solid #e0e0e0;
	}

	.menu-group {
		display: flex;
		gap: 0.25rem;
	}

	.menu-divider {
		width: 1px;
		background: #e0e0e0;
		margin: 0 0.25rem;
	}

	.menu-bar button {
		padding: 0.5rem 0.75rem;
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.2s;
		min-width: 36px;
	}

	.menu-bar button:hover:not(:disabled) {
		background: #e3f2fd;
		border-color: #667eea;
	}

	.menu-bar button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.menu-bar button.is-active {
		background: #667eea;
		color: white;
		border-color: #667eea;
	}

	.editor-content {
		min-height: 300px;
	}

	:global(.editor-content .ProseMirror) {
		min-height: 300px;
		padding: 1rem;
		outline: none;
	}

	:global(.editor-content .ProseMirror h1) {
		font-size: 2em;
		font-weight: bold;
		margin-top: 0.67em;
		margin-bottom: 0.67em;
	}

	:global(.editor-content .ProseMirror h2) {
		font-size: 1.5em;
		font-weight: bold;
		margin-top: 0.83em;
		margin-bottom: 0.83em;
	}

	:global(.editor-content .ProseMirror h3) {
		font-size: 1.17em;
		font-weight: bold;
		margin-top: 1em;
		margin-bottom: 1em;
	}

	:global(.editor-content .ProseMirror p) {
		margin: 1em 0;
	}

	:global(.editor-content .ProseMirror ul),
	:global(.editor-content .ProseMirror ol) {
		padding-left: 2em;
		margin: 1em 0;
	}

	:global(.editor-content .ProseMirror blockquote) {
		border-left: 4px solid #ddd;
		padding-left: 1em;
		margin: 1em 0;
		font-style: italic;
		color: #666;
	}

	:global(.editor-content .ProseMirror a) {
		color: #667eea;
		text-decoration: underline;
	}

	:global(.editor-content .ProseMirror img) {
		max-width: 100%;
		height: auto;
		border-radius: 4px;
	}

	:global(.editor-content .ProseMirror code) {
		background: #f5f5f5;
		padding: 0.2em 0.4em;
		border-radius: 3px;
		font-family: monospace;
	}

	:global(.editor-content .ProseMirror pre) {
		background: #f5f5f5;
		padding: 1em;
		border-radius: 4px;
		overflow-x: auto;
	}

	@media (max-width: 768px) {
		.menu-bar {
			flex-direction: column;
			align-items: stretch;
		}

		.menu-group {
			flex-wrap: wrap;
		}

		.menu-divider {
			display: none;
		}
	}
</style>
