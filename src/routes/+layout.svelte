<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import { page } from '$app/state';
	import PixelGridBackground from '#lib/components/PixelGridBackground.svelte';

	let { children }: LayoutProps = $props();

	let isViewRoute = $derived(page.url.pathname.startsWith('/view'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>asciing.app — generative creative coding studio</title>
</svelte:head>

<div
	class="flex flex-col min-h-screen text-white font-sans selection:bg-[#FF605C] selection:text-white relative"
	style="background: radial-gradient(ellipse 50% 50% at 0% 0%, #4a0a09 0%, #200404 40%, #000000 100%) no-repeat, #000000;"
>
	<!-- Glowing Pixel Grid Background (only on non-view routes) -->
	{#if !isViewRoute}
		<PixelGridBackground />
	{/if}

	<main class="flex-1 flex flex-col min-h-0 relative z-10">
		{@render children()}
	</main>
</div>
