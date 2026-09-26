# WK Flash

A SvelteKit app that reviews WaniKani items Anki-style: each card asks for the meaning
*and* reading together, then submits a single combined result back to WaniKani via its API.

Your WaniKani API token is stored only in the browser's `localStorage` (see
[src/lib/storage.ts](src/lib/storage.ts)) and is sent directly from the browser to the
WaniKani API — this app has no backend of its own.

## Developing

```sh
npm install
npm run dev -- --open
```

Open Settings and paste a [WaniKani personal access token](https://www.wanikani.com/settings/personal_access_tokens),
then start a review from the home page.

## Building

```sh
npm run build
```

This project uses `@sveltejs/adapter-vercel`, so pushing/importing the repo into
[Vercel](https://vercel.com) will build and deploy it automatically. `npm run preview`
serves the production build locally.


> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
