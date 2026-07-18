import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/src/supabaseClient";

export const revalidate = 3600; // refresh hourly

export const metadata: Metadata = {
  title: "Plumbing Blog — KZN Plumbers Directory",
  description:
    "Expert plumbing tips, maintenance guides, and KwaZulu-Natal plumbing news. Stay informed with the latest from KZN Plumbers Directory.",
};

type Article = {
  id: string;
  title: string;
  slug: string;
  meta_description: string | null;
  keywords: string[] | null;
  publish_date: string;
  word_count: number | null;
};

export default async function BlogPage() {
  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, slug, meta_description, keywords, publish_date, word_count")
    .order("publish_date", { ascending: false });

  const posts = (articles ?? []) as Article[];

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand to-brand-dark text-white py-10 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold mb-3">
            Plumbing Blog
          </h1>
          <p className="text-sm sm:text-lg opacity-90 max-w-xl mx-auto">
            Expert tips, maintenance guides, and local plumbing news for KwaZulu-Natal homeowners.
          </p>
        </div>
      </section>

      {/* Articles */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📝</div>
            <h2 className="font-display text-2xl font-bold mb-2">
              Coming soon
            </h2>
            <p className="text-gray-600">
              We&apos;re working on helpful plumbing guides and local news. Check back soon!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((article, i) => (
              <article
                key={article.id}
                className={`bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-brand transition-all ${
                  i === 0 ? "sm:p-8" : ""
                }`}
              >
                <Link href={`/blog/${article.slug}`} className="block group">
                  <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
                    <time dateTime={article.publish_date}>
                      {new Date(article.publish_date).toLocaleDateString("en-ZA", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                    {article.word_count && (
                      <>
                        <span>·</span>
                        <span>{Math.ceil(article.word_count / 200)} min read</span>
                      </>
                    )}
                  </div>
                  <h2
                    className={`font-display font-bold text-gray-900 group-hover:text-brand transition-colors leading-snug mb-2 ${
                      i === 0 ? "text-xl sm:text-2xl" : "text-lg"
                    }`}
                  >
                    {article.title}
                  </h2>
                  {article.meta_description && (
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                      {article.meta_description}
                    </p>
                  )}
                  {article.keywords && article.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {article.keywords.slice(0, 4).map((kw) => (
                        <span
                          key={kw}
                          className="text-[10px] px-2 py-0.5 rounded bg-brand-light text-brand font-semibold"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-sm text-brand font-semibold mt-3 group-hover:underline">
                    Read article →
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
