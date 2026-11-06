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
