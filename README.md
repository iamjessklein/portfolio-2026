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
