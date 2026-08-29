import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sanitizeEditorialHtml } from "@/lib/sanitize";
import { safeJsonLd } from "@/lib/json-ld";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getPublicSupabase } from "@/lib/supabase/public";

export const revalidate = 3600;

type Article = {
  id: string;
  title: string;
  slug: string;
  meta_title: string | null;
  meta_description: string | null;
  body: string;
  keywords: string[] | null;
  internal_links: string[] | null;
  publish_date: string;
  word_count: number | null;
};

async function getArticle(slug: string): Promise<Article | null> {
  const supabase = getPublicSupabase();
  if (!supabase) return null;
  const { data } = await supabase.from("articles").select("*").eq("slug", slug).maybeSingle();
  return data as Article | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Article not found | KZN Plumbers", robots: { index: false, follow: true } };
  const title = article.meta_title ?? `${article.title} | KZN Plumbers`;
  const description = article.meta_description ?? `Read ${article.title} on KZN Plumbers Directory.`;
  const canonical = `/blog/${article.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: absoluteUrl(canonical), siteName: SITE_NAME, type: "article", locale: "en_ZA" },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();
  const supabase = getPublicSupabase();
  const relatedResult = supabase
    ? await supabase
        .from("articles")
        .select("id, title, slug, meta_description, publish_date")
        .neq("slug", slug)
        .order("publish_date", { ascending: false })
        .limit(3)
    : { data: [] };
  const related = relatedResult.data ?? [];
  const body = sanitizeEditorialHtml(article.body);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.meta_description,
    datePublished: article.publish_date,
    dateModified: article.publish_date,
    mainEntityOfPage: absoluteUrl(`/blog/${article.slug}`),
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <header className="bg-slate-950 px-4 py-12 text-white sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <Link href="/blog" className="text-sm font-semibold text-sky-300 hover:text-white">← Back to guides</Link>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl">{article.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <time dateTime={article.publish_date}>{new Date(article.publish_date).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}</time>
            {article.word_count ? <><span aria-hidden="true">·</span><span>{Math.max(1, Math.ceil(article.word_count / 200))} min read</span></> : null}
          </div>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="seo-content" dangerouslySetInnerHTML={{ __html: body }} />
        <aside className="mt-10 rounded-2xl border border-slate-200 bg-slate-100 p-6 text-center">
          <h2 className="font-display text-xl font-bold text-slate-950">Need a KZN plumber?</h2>
          <p className="mt-2 text-sm text-slate-600">Compare relevant directory records, read the verification label and contact the business directly.</p>
          <Link href="/#directory-results" className="btn-primary mt-5">Search the directory</Link>
        </aside>
      </article>

      {related.length > 0 && (
        <section className="mx-auto max-w-3xl border-t border-slate-200 px-4 pb-12 pt-8 sm:px-6">
          <h2 className="font-display text-2xl font-bold text-slate-950">More KZN guides</h2>
          <div className="mt-5 space-y-3">
            {related.map((item) => (
              <Link key={item.id} href={`/blog/${item.slug}`} className="block rounded-xl border border-slate-200 bg-white p-5 hover:border-brand hover:shadow-md">
                <h3 className="font-display text-lg font-bold text-slate-950">{item.title}</h3>
                {item.meta_description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.meta_description}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
