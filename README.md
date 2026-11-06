# jessicaklein.com (digital garden)

Built with [Eleventy](https://www.11ty.dev/). Each project is a "note" in `src/notes/`.

```
npm install
npm start      # local preview at http://localhost:8080
npm run build  # writes _site/
```

## Adding or updating a note

Create `src/notes/my-note.html` with front matter:

```
---
title: "My note"
summary: "One line shown on the garden index."
stage: seedling        # seedling | budding | evergreen
garden: balcony        # community (made with a team) | balcony (made on my own)
order: 3               # position on the index
topics: ["experimentation"]
---
<p>Body goes here.</p>
```

Old URLs (`/projects/<slug>.html`) are preserved.

## Still to build
Writing archive (Medium + old blog), Bookshelf (Goodreads), Now page (Spotify, art strip), RSS.

## Medium feed

`scripts/sync-medium.mjs` reads Medium's RSS feed (latest ~10 posts) and merges new ones into `src/_data/medium.json`.
It runs on every deploy and daily on a schedule. If Medium is unreachable it keeps the existing file.
`src/_data/writing.js` then places each post: curated posts get their real URL (matched by title);
new ones go to the project named in `src/_data/mediumMap.json` (`byUrl`, then `byCategory`),
otherwise into an unplanted "New on Medium" group on the Writing page.
Run locally: `npm run sync:medium`. Commit `medium.json` to keep posts that scroll out of the feed.

## Goodreads

Goodreads' RSS feed isn't available for this account, so the bookshelf is built from an export.
Goodreads > My Books > Import and export > Export Library, save the file as
`src/_data/goodreads_library_export.csv`, then `npm run sync:goodreads` and commit.
That refreshes the stats, currently reading, shelf counts, tags and the 8 most recent written reviews in `src/_data/books.json`.
The favorites and shelf blurbs in that file are hand-written and never overwritten.

## Deploying

GitHub Pages source must be set to **GitHub Actions** (Settings > Pages). Every push to `main` builds with Eleventy and publishes `_site`.
