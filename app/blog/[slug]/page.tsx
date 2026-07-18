import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/src/supabaseClient";
import { notFound } from "next/navigation";

export const revalidate = 3600; // refresh hourly

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const { data: article } = await supabase
    .from("articles")
    .select("title, meta_title, meta_description, slug")
    .eq("slug", slug)
    .single();

  if (!article) {
    return { title: "Article not found — KZN Plumbers" };
  }

  const title = article.meta_title ?? `${article.title} — KZN Plumbers Blog`;
  const description =
    article.meta_description ??
    `Read "${article.title}" on the KZN Plumbers Directory blog.`;

  const canonical = `https://www.kznplumbers.co.za/blog/${article.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "KZN Plumbers",
      type: "article",
      locale: "en_ZA",
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: article } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!article) notFound();

  const post = article as Article;

  // Fetch other recent articles for "More articles" section
  const { data: relatedArticles } = await supabase
    .from("articles")
    .select("id, title, slug, meta_description, publish_date")
    .neq("slug", slug)
    .order("publish_date", { ascending: false })
    .limit(3);

  const related = (relatedArticles ?? []) as Array<{
    id: string;
    title: string;
    slug: string;
    meta_description: string | null;
    publish_date: string;
  }>;

  return (
    <>
      {/* Article header */}
      <section className="bg-gradient-to-br from-brand to-brand-dark text-white py-8 sm:py-14 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/blog"
            className="text-xs sm:text-sm opacity-80 hover:opacity-100 underline"
          >
            ← Back to blog
          </Link>
          <h1 className="font-display text-xl sm:text-3xl md:text-4xl font-extrabold mt-3 sm:mt-4 leading-tight">
            {post.title}
          </h1>
          <div className="flex items-center gap-3 mt-3 text-sm opacity-80">
            <time dateTime={post.publish_date}>
              {new Date(post.publish_date).toLocaleDateString("en-ZA", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
            {post.word_count && (
              <>
                <span>·</span>
                <span>{Math.ceil(post.word_count / 200)} min read</span>
              </>
            )}
          </div>
          {post.keywords && post.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {post.keywords.map((kw) => (
                <span
                  key={kw}
                  className="text-[10px] px-2 py-0.5 rounded bg-white/15 text-white font-semibold"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Article body */}
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div
          className="prose prose-gray max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-brand prose-a:underline prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: post.body }}
        />

        {/* CTA */}
        <div className="mt-10 p-6 bg-gradient-to-r from-brand-light to-blue-50 border border-brand/20 rounded-xl text-center">
          <h3 className="font-display text-lg font-bold text-gray-900 mb-2">
            Need a plumber in KwaZulu-Natal?
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Browse 1,200+ verified, PIRB-registered plumbers and get a quote via
            WhatsApp in minutes.
          </p>
          <Link href="/" className="btn-primary">
            Find a plumber →
          </Link>
        </div>
      </article>

      {/* Related articles */}
      {related.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-12 border-t border-gray-200 pt-8">
          <h2 className="font-display text-xl font-bold mb-4">
            More articles
          </h2>
          <div className="space-y-4">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/blog/${r.slug}`}
                className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-brand hover:shadow-md transition-all group"
              >
                <div className="text-xs text-gray-500 mb-1">
                  {new Date(r.publish_date).toLocaleDateString("en-ZA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
                <h3 className="font-display font-bold text-gray-900 group-hover:text-brand transition-colors">
                  {r.title}
                </h3>
                {r.meta_description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {r.meta_description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
