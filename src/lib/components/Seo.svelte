<script lang="ts">
	import { page } from '$app/state';
	import { absoluteUrl, defaultDescription, isPublicPath, siteName } from '$lib/seo';

	let {
		title,
		description = defaultDescription
	}: {
		title: string;
		description?: string;
	} = $props();

	const path = $derived(page.url.pathname);
	const origin = $derived(page.url.origin);
	const url = $derived(absoluteUrl(origin, path));
	const image = $derived(absoluteUrl(origin, '/wk-flash-icon.svg'));
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
</svelte:head>
