"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, SearchIcon } from "@/components/icons";
import type { HelpArticle } from "@/lib/help";

export function HelpList({ posts }: { posts: HelpArticle[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) =>
      [post.title, post.description, post.category].some((field) => field.toLowerCase().includes(q))
    );
  }, [posts, query]);

  return (
    <section className="bg-cream py-14 lg:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="relative mx-auto mb-10 max-w-md">
          <SearchIcon className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search advice and guides"
            aria-label="Search advice and guides"
            className="h-[60px] w-full rounded-full border border-line bg-white pl-13 pr-5 text-base text-navy outline-none transition-colors placeholder:text-text-3 focus:border-navy/40"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-base text-text-2">
            No articles match &ldquo;{query}&rdquo;. Try a different search, or{" "}
            <Link href="/contact" className="font-semibold text-navy underline decoration-navy/30 underline-offset-4">
              ask us directly
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((post) => (
              <Link
                key={post.slug}
                href={`/help/${post.slug}`}
                className="group flex flex-col rounded-[24px] border border-line bg-white p-7 transition-colors hover:bg-grey"
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-3">{post.category}</p>
                <h2 className="mt-3 text-[23px] font-extrabold leading-tight tracking-tight text-navy">{post.title}</h2>
                <p className="mt-2 flex-1 text-base leading-relaxed text-text-2">{post.description}</p>
                <div className="mt-5 flex items-center justify-between text-xs font-semibold text-text-3">
                  <span>{post.readTime}</span>
                  <span className="inline-flex items-center gap-1.5 text-navy">
                    Read
                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
