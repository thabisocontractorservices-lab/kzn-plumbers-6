import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleList } from "@/lib/directory-editorial";
import { parseDirectorySearch } from "@/lib/directory";

export const revalidate = 300;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const { page } = parseDirectorySearch(await searchParams);
  return {
    title: `Plumbing Blog${page > 1 ? ` — Page ${page}` : ""} | KZN Plumbers Directory`,
    description: "Plumbing guidance for KwaZulu-Natal homeowners, including maintenance, compliance and local service information.",
    alternates: { canonical: page > 1 ? `/blog?page=${page}` : "/blog" },
  };
}

export default async function BlogPage({ searchParams }: { searchParams: Search }) {
  const { page } = parseDirectorySearch(await searchParams);
  const limit = 12;
  const { articles: posts, total } = await getArticleList(page, limit);
  const pages = Math.max(1, Math.ceil(total / limit));
  if (page > pages) notFound();

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand to-brand-dark text-white py-10 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold mb-3">
            Plumbing Blog
          </h1>
          <p className="text-sm sm:text-lg opacity-90 max-w-xl mx-auto">
            Plumbing guidance and local information for KwaZulu-Natal homeowners.
          </p>
        </div>
      </section>

      {/* Articles */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <h2 className="font-display text-2xl font-bold mb-2">
              No published articles yet
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
        {pages > 1 && <nav aria-label="Blog pages" className="mt-8 flex items-center justify-between gap-4">
          {page > 1 ? <Link href={page === 2 ? "/blog" : `/blog?page=${page - 1}`} className="btn-secondary">Previous</Link> : <span />}
          <span className="text-sm text-slate-600">Page {page} of {pages}</span>
          {page < pages ? <Link href={`/blog?page=${page + 1}`} className="btn-secondary">Next</Link> : <span />}
        </nav>}
      </section>
    </>
  );
}
