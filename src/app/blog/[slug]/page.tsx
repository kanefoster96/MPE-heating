import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { PromoStrip } from "@/components/PromoStrip";
import { BlogArticle } from "@/components/BlogArticle";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { FloatingWhatsapp } from "@/components/FloatingWhatsapp";
import { JsonLd } from "@/components/JsonLd";
import { ArrowRightIcon, ChevronLeftIcon } from "@/components/icons";
import { blogPosts, getBlogPost } from "@/lib/blog";
import { SITE_URL, articleJsonLd } from "@/lib/seo";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `${SITE_URL}/blog/${post.slug}` },
    openGraph: { url: `${SITE_URL}/blog/${post.slug}`, type: "article" },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const publishedDate = new Date(post.publishedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Nav />
      <PromoStrip />
      <main className="bg-cream py-10 sm:py-14">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy/60 transition-colors hover:text-navy"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            All advice & guides
          </Link>

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
            {post.category}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-navy sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-sm text-navy/50">
            {publishedDate} · {post.readTime}
          </p>

          <div className="mt-8 rounded-[28px] bg-white p-6 shadow-[0_20px_45px_-25px_rgba(31,42,58,0.3)] sm:p-10">
            <BlogArticle blocks={post.content} />
          </div>

          <Link
            href={post.relatedService.href}
            className="bg-btn-gradient mt-8 flex items-center justify-between gap-4 rounded-2xl px-6 py-5 text-white"
          >
            <span className="text-base font-semibold">{post.relatedService.label}</span>
            <ArrowRightIcon className="h-5 w-5 shrink-0" />
          </Link>
        </div>
      </main>
      <FinalCta />
      <Footer />
      <FloatingWhatsapp />
      <JsonLd data={articleJsonLd(post)} />
    </>
  );
}
