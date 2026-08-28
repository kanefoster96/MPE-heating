import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { blogPosts } from "@/lib/blog";
import { areaPages } from "@/lib/areas";

// /login and /create-account are deliberately excluded — they're
// noindex'd account utility pages (see their metadata), not content worth
// listing for search engines.
const routes = [
  { path: "", priority: 1, changeFrequency: "weekly" as const },
  { path: "/boiler-repair", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/servicing", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/new-boilers", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/commercial", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/areas", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/faqs", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" as const },
  { path: "/contact", priority: 0.6, changeFrequency: "yearly" as const },
  ...areaPages.map((area) => ({
    path: `/areas/${area.slug}`,
    priority: 0.8,
    changeFrequency: "monthly" as const,
  })),
  ...blogPosts.map((post) => ({
    path: `/blog/${post.slug}`,
    priority: 0.6,
    changeFrequency: "yearly" as const,
  })),
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
