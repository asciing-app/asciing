<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import { page } from '$app/state';

	let { children }: LayoutProps = $props();

	let isViewRoute = $derived(page.url.pathname.startsWith('/view'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>asciing.app — generative creative coding studio</title>
</svelte:head>

<div class="flex flex-col min-h-screen bg-[#09090b] text-[#fafafa] font-mono selection:bg-[#38bdf8] selection:text-black">
	{#if !isViewRoute}
		<header class="h-12 border-b border-[#27272a] px-4 flex items-center justify-between bg-[#09090b]/80 backdrop-blur shrink-0 z-40">
			<div class="flex items-center gap-6">
				<a href="/" class="flex items-center gap-2 group">
					<span class="w-3 h-3 bg-[#38bdf8] group-hover:scale-110 transition-transform"></span>
					<span class="font-bold tracking-wider text-sm text-[#fafafa]">asciing.app</span>
				</a>
				<nav class="flex items-center gap-4 text-xs text-[#a1a1aa]">
					<a href="/" class="hover:text-[#fafafa] transition-colors">GALLERY</a>
				</nav>
			</div>
			<div class="flex items-center gap-3 text-xs text-[#a1a1aa]">
				<span class="text-[11px] text-[#71717a] hidden sm:inline">ZERO-BACKEND STUDIO</span>
				<a
					href="https://github.com"
					target="_blank"
					rel="noreferrer"
					class="hover:text-[#fafafa] transition-colors"
				>
					GITHUB
				</a>
			</div>
		</header>
	{/if}

	<main class="flex-1 flex flex-col min-h-0 relative">
		{@render children()}
	</main>
</div>
