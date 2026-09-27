<svelte:head>
	<title>About WK Flash</title>
	<meta
		name="description"
		content="WK Flash is an unofficial third-party study app for WaniKani users, independent of WaniKani and Tofugu."
	/>
</svelte:head>

<div class="container about-content">
	<h1>About WK Flash</h1>
	<p>
		WK Flash is an <strong>unofficial, third-party study app for WaniKani users</strong>. It is
		independently created and is not made, owned, approved, or endorsed by WaniKani or Tofugu.
	</p>

	<section>
		<h2>Using WK Flash</h2>
		<p>
			WK Flash connects to WaniKani through its API with a personal API token. It does not ask for
			your WaniKani password. Keep your token private; it provides access to your account through the
			API.
		</p>
		<p>
			WaniKani's API guidance requires third-party tools to respect each account's subscription
			access limits. Using WK Flash does not grant access to WaniKani content or levels that your
			account cannot access. The guidance also says WaniKani subject content may not be used to build
			for-profit tools.
		</p>
	</section>

	<section>
		<h2>Independent project</h2>
		<p>
			WaniKani and its content, names, and artwork belong to their respective owners. WK Flash has
			its own name and interface and is not affiliated with or sponsored by WaniKani or Tofugu.
		</p>
	</section>

	<section>
		<h2>Official information</h2>
		<ul>
			<li>
				<a href="https://docs.api.wanikani.com/20170710/#branding-rules" target="_blank" rel="noopener noreferrer">
					WaniKani API branding rules
				</a>
			</li>
			<li>
				<a href="https://www.wanikani.com/terms#f-intellectual-property-notice" target="_blank" rel="noopener noreferrer">
					WaniKani Terms of Service
				</a>
			</li>
		</ul>
		<p class="muted">WaniKani's terms and API guidance may change. Refer to their current official documents.</p>
	</section>
</div>

<style>
	.about-content {
		max-width: 760px;
	}

	section {
		margin-top: 2rem;
	}

	h2 {
		font-size: 1.2rem;
	}

	li + li {
		margin-top: 0.5rem;
	}

	.muted {
		color: var(--muted);
	}
</style>