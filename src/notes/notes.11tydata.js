// Keep the old Notion-era URLs alive: /projects/<slug>.html
export default {
  layout: "note.njk",
  permalink: (data) => `/projects/${data.page.fileSlug}.html`,
};
