import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/src/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// SEO Content Pages — reads from the `seo_pages` Supabase table.
//
// Renders one page per row at top-level URLs (/24-hour-plumber-kzn etc.).
// If your Supabase table is named differently, change SEO_TABLE below.
// ─────────────────────────────────────────────────────────────────────────────

const SEO_TABLE = "seo_pages";

// faq_schema can come back as either a string (if column is text) or an
// object (if column is jsonb). We handle both safely below.
type SeoPage = {
  slug: string;
  h1: string;
  meta_title: string;
  meta_description: string;
  body_html: string;
  faq_schema: string | Record<string, unknown> | null;
  group_name: string | null;
  city_focus: string | null;
};

// Refresh content from Supabase every hour (Incremental Static Regeneration).
export const revalidate = 3600;

async function getPage(slug: string): Promise<SeoPage | null> {
  const { data } = await supabase
    .from(SEO_TABLE)
    .select(
      "slug, h1, meta_title, meta_description, body_html, faq_schema, group_name, city_focus",
    )
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle<SeoPage>();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return { title: "Page not found — KZN Plumbers" };
  return {
    title: page.meta_title,
    description: page.meta_description,
    alternates: { canonical: `/${slug}` },
    openGraph: {
      title: page.meta_title,
      description: page.meta_description,
      type: "article",
      url: `/${slug}`,
    },
  };
}

// Pre-build all 80 pages at build time so they're served as static HTML.
// Falls back to on-demand if Supabase is unreachable during build.
export async function generateStaticParams() {
  try {
    const { data } = await supabase
      .from(SEO_TABLE)
      .select("slug")
      .eq("published", true);
    return (data ?? []).map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export default async function SeoContentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <article className="max-w-3xl mx-auto px-6 py-12 lg:py-16">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-brand">
          Home
        </Link>
        {page.city_focus && (
          <>
            <span className="mx-2">/</span>
            <span>{page.city_focus}</span>
          </>
        )}
        {page.group_name && (
          <>
            <span className="mx-2">/</span>
            <span>{page.group_name}</span>
          </>
        )}
      </nav>

      {/* H1 from the table */}
      <h1 className="font-display text-3xl md:text-4xl font-extrabold text-gray-900 mb-6 leading-tight">
        {page.h1}
      </h1>

      {/* Body HTML rendered with article styling */}
      <div
        className="seo-content"
        dangerouslySetInnerHTML={{ __html: page.body_html }}
      />

      {/* FAQ JSON-LD schema for Google rich results.
          Stringify if it's a parsed object (jsonb column) — otherwise
          React would emit "[object Object]" and break structured data. */}
      {page.faq_schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html:
              typeof page.faq_schema === "string"
                ? page.faq_schema
                : JSON.stringify(page.faq_schema),
          }}
        />
      )}

      {/* Bottom CTA */}
      <div className="mt-12 p-6 bg-brand-light rounded-xl border border-brand/20">
        <p className="text-sm text-gray-700 mb-3">
          Looking for a verified plumber in {page.city_focus ?? "KwaZulu-Natal"}?
        </p>
        <Link href="/" className="btn-primary">
          Browse the directory →
        </Link>
      </div>
    </article>
  );
}
