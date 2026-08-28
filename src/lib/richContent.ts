// Shared block-content type for any page whose body is a sequence of
// headings/paragraphs/lists/callouts — blog posts, and now legal/info
// pages (privacy, terms, about) too. Rendered by RichContent.tsx.
export type ContentBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "callout"; text: string };
