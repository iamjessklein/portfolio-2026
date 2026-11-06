import { readFileSync } from "node:fs";
export default function (eleventyConfig) {
  eleventyConfig.addGlobalData("buildStamp", () => Date.now().toString(36)); // cache-busts the stylesheet on every deploy
  // Existing project pages are plain HTML; don't run them through a template engine.
  eleventyConfig.setFreezeReservedData(false);
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/css": "css" });
  eleventyConfig.addPassthroughCopy({ "src/favicon": "/" });
  eleventyConfig.addPassthroughCopy({ "CNAME": "CNAME" });
  eleventyConfig.addPassthroughCopy({ ".nojekyll": ".nojekyll" });

  eleventyConfig.addFilter("spineHeight", (title, i) => Math.round(Math.min(290, 150 + title.length * 4.5 + (i % 3) * 10)));

  // Projects with real writing in them come first; inside each half, the `order` number decides.
  // A note counts as filled in once it has about a paragraph of text and isn't the "still to be written" stub.
  const hasContent = (item) => {
    const body = readFileSync(item.inputPath, "utf8").replace(/^---\n[\s\S]*?\n---\n?/, "");
    return !/still to be written|needs watering|needs tending/i.test(body) && body.replace(/<[^>]+>/g, "").trim().length >= 100;
  };
  eleventyConfig.addFilter("needsTending", (item) => !hasContent(item));
  eleventyConfig.addCollection("garden", (api) =>
    api.getFilteredByGlob("src/notes/*.html").sort((a, b) =>
      (hasContent(b) - hasContent(a)) || ((a.data.order ?? 99) - (b.data.order ?? 99))
    )
  );

  return {
    dir: { input: "src", output: "_site", includes: "_includes" },
    htmlTemplateEngine: false,
    markdownTemplateEngine: "njk",
  };
}
