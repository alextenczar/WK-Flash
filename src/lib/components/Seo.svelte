<script lang="ts">
	import { page } from '$app/state';
	import {
		absoluteUrl,
		defaultDescription,
		isPublicPath,
		jsonLdScript,
		siteName,
		siteOrigin,
		webSiteJsonLd
	} from '$lib/seo';

	let {
		title,
		description = defaultDescription,
		includeWebSite = false
	}: {
		title: string;
		description?: string;
		/** Emit WebSite JSON-LD. Only the homepage sets this so the structured data appears once. */
		includeWebSite?: boolean;
	} = $props();

	const path = $derived(page.url.pathname);
	const origin = $derived(siteOrigin(page.url.origin));
	const url = $derived(absoluteUrl(origin, path));
	const image = $derived(absoluteUrl(origin, '/og-image.png'));
	const indexable = $derived(isPublicPath(path));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta name="robots" content={indexable ? 'index, follow' : 'noindex, nofollow'} />
	<link rel="canonical" href={url} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={siteName} />
	<meta property="og:locale" content="en_US" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={image} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
	{#if includeWebSite}
		{@html jsonLdScript(webSiteJsonLd(origin))}
	{/if}
</svelte:head>
