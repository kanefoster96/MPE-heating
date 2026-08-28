"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, SearchIcon } from "@/components/icons";
import type { BlogPost } from "@/lib/blog";

export function BlogList({ posts }: { posts: BlogPost[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) =>
      [post.title, post.description, post.category].some((field) =>
        field.toLowerCase().includes(q)
      )
    );
  }, [posts, query]);

  return (
    <section className="bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="relative mx-auto mb-10 max-w-md">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-navy/35" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search advice & guides…"
            aria-label="Search advice & guides"
            className="w-full rounded-2xl border border-line py-3 pl-11 pr-4 text-base text-navy outline-none transition-colors placeholder:text-navy/40 focus:border-terracotta"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-sm text-navy/60">
            No articles match &ldquo;{query}&rdquo; — try a different search, or{" "}
            <Link href="/contact" className="font-semibold text-terracotta hover:underline">
              ask us directly
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {filtered.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col rounded-[24px] bg-grey p-7 transition-colors hover:bg-grey/70"
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
                  {post.category}
                </p>
                <h2 className="mt-3 text-xl font-bold text-navy">{post.title}</h2>
                <p className="mt-2 flex-1 text-sm text-navy/70">{post.description}</p>
                <div className="mt-5 flex items-center justify-between text-xs font-semibold text-navy/50">
                  <span>{post.readTime}</span>
                  <span className="inline-flex items-center gap-1.5 text-terracotta">
                    Read more
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
