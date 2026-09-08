const base = (process.env.VERIFY_BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const checks = [
  ["/", 250_000],
  ["/?area=durban&service=blocked-drains", 250_000],
  ["/plumbers/durban", 250_000],
  ["/services/blocked-drains", 250_000],
  ["/all-plumbers", 300_000],
  ["/trust", 150_000],
  ["/help", 150_000],
  ["/resources/plumbing-coc-kzn", 180_000],
  ["/plumber/topsun-solar-solutions", 250_000],
];
let failures = 0;
for (const [pathname, budget] of checks) {
  const response = await fetch(`${base}${pathname}`, { redirect: "manual" });
  const html = await response.text();
  const bytes = Buffer.byteLength(html);
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1] || "";
  const h1Count = (html.match(/<h1\b/g) || []).length;
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1] || "";
  if (response.status !== 200 || !title || h1Count !== 1 || !canonical || bytes > budget) {
    failures++;
    console.error("FAIL", { pathname, status: response.status, title: Boolean(title), h1Count, canonical, bytes, budget });
  } else {
    console.log("PASS", pathname, `${bytes} bytes`, title);
  }
}

const robots = await (await fetch(`${base}/robots.txt`)).text();
if (robots.includes("Disallow: /claim/") || robots.includes("Disallow: /review/")) {
  failures++;
  console.error("FAIL robots.txt blocks a noindex or redirect route");
} else console.log("PASS robots.txt crawl controls");

const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
if (!sitemap.includes("<sitemapindex") || !sitemap.includes("/sitemaps/profiles.xml")) {
  failures++;
  console.error("FAIL sitemap index");
} else console.log("PASS split sitemap index");

const profileSitemap = await (await fetch(`${base}/sitemaps/profiles.xml`)).text();
const profileUrls = (profileSitemap.match(/<url>/g) || []).length;
if (!profileSitemap.includes("<urlset") || profileUrls === 0 || profileUrls > 10_000) {
  failures++;
  console.error("FAIL profile sitemap", { profileUrls });
} else console.log("PASS profile sitemap", `${profileUrls} indexable profiles`);

const contentSitemap = await (await fetch(`${base}/sitemaps/content.xml`)).text();
if (["gas-cape-town", "durbanville"].some((term) => contentSitemap.includes(term))) {
  failures++;
  console.error("FAIL off-scope geography remains in content sitemap");
} else console.log("PASS off-scope geography excluded");

const apiResponse = await fetch(`${base}/api/plumbers?area=durban&limit=24`);
const apiData = await apiResponse.json();
if (!apiResponse.ok || !Array.isArray(apiData.plumbers) || apiData.plumbers.length > 24) {
  failures++;
  console.error("FAIL bounded plumber API");
} else console.log("PASS bounded plumber API", `${apiData.plumbers.length} of ${apiData.total}`);

if (failures) process.exit(1);
console.log(`Verified ${checks.length} HTML routes plus robots and sitemap.`);
