export default function (eleventyConfig) {
  // Existing project pages are plain HTML; don't run them through a template engine.
  eleventyConfig.setFreezeReservedData(false);
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/css": "css" });
  eleventyConfig.addPassthroughCopy({ "CNAME": "CNAME" });
  eleventyConfig.addPassthroughCopy({ ".nojekyll": ".nojekyll" });

  eleventyConfig.addFilter("spineHeight", (title, i) => Math.round(Math.min(290, 150 + title.length * 4.5 + (i % 3) * 10)));

  eleventyConfig.addCollection("garden", (api) =>
    api.getFilteredByGlob("src/notes/*.html").sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99))
  );

  return {
    dir: { input: "src", output: "_site", includes: "_includes" },
    htmlTemplateEngine: false,
    markdownTemplateEngine: "njk",
  };
}
