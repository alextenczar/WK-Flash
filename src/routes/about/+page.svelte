<svelte:head>
	<title>About WK Flash</title>
	<meta
		name="description"
		content="WK Flash is an unofficial third-party study app for WaniKani users, combining meaning and reading reviews on one card to help cut review time in half."
	/>
</svelte:head>

<div class="container about-content">
	<h1>About WK Flash</h1>
	<p>
		WK Flash is an <strong>unofficial, third-party study app for WaniKani users</strong>. It brings
		meaning and reading reviews together on one flashcard and should cut your review time in half.
		Independently developed, WK Flash is not made, owned, approved, or endorsed by WaniKani or Tofugu.
	</p>

	<section class="features" aria-labelledby="features-heading">
		<h2 id="features-heading">What WK Flash adds</h2>
		<p>Alongside your WaniKani account, WK Flash adds tools for reviewing, tracking, and customizing your study flow.</p>
		<ul class="feature-list">
			<li>
				<h3>Combined meaning and reading reviews</h3>
				<p>Answer both parts on one card, then send one combined review result to WaniKani.</p>
			</li>
			<li>
				<h3>Offline review continuity</h3>
				<p>Resume an in-progress session offline and queue completed answers for automatic sync when your connection returns.</p>
			</li>
			<li>
				<h3>JLPT progress analytics</h3>
				<p>Track kanji and vocabulary by JLPT level, search level-specific or cross-level results, explore an SRS heatmap, and compare JLPT curriculum coverage across WaniKani levels.</p>
			</li>
			<li>
				<h3>Related item details</h3>
				<p>Look up visually similar kanji, kanji components, and vocabulary grouped by reading while reviewing.</p>
			</li>
			<li>
				<h3>Personal review controls</h3>
				<p>Customize review keybindings, show or hide mnemonics and parts of speech, and adjust pronunciation playback and volume.</p>
			</li>
			<li>
				<h3>Review sorting</h3>
				<p>Order new reviews by SRS stage, WaniKani level, or item type; keep WaniKani's default order or shuffle randomly. You can also prioritize items from your current level.</p>
			</li>
			<li>
				<h3>SRS feedback and review planning</h3>
				<p>See SRS stage changes after answers, review counts due and completed today, a 24-hour review timeline, and the exact items in each upcoming WaniKani batch.</p>
			</li>
			<li>
				<h3>Optional local N1 review track</h3>
				<p>Interweave an opt-in set of supplemental N1 kanji and related vocabulary into reviews. These cards are scheduled only on your device and are never submitted to WaniKani.</p>
			</li>
		</ul>
	</section>

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
		<h2>Install on your phone</h2>
		<p>Add WK Flash to your home screen to open it in an app-like window.</p>
		<ul>
			<li>
				<strong>iPhone:</strong> Open WK Flash in Safari, tap the Share button, choose “Add to Home
				Screen,” then tap “Add.”
			</li>
			<li>
				<strong>Android:</strong> Open WK Flash in Chrome, tap the menu button, choose “Install app”
				(or “Add to Home screen”), then confirm.
			</li>
		</ul>
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
	section {
		margin-top: 2rem;
	}

	.features > p {
		color: var(--muted);
	}

	.feature-list {
		margin: 1rem 0 0;
		padding: 0;
		list-style: none;
	}

	.feature-list li {
		padding: 0.85rem 0;
		border-top: 1px solid var(--border);
	}

	.feature-list h3 {
		margin: 0;
		font-size: 1rem;
	}

	.feature-list p {
		margin: 0.3rem 0 0;
		color: var(--muted);
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