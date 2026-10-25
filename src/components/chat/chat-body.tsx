import { parseChatBody } from "@/lib/chat-links";

/**
 * A message's text. A coach's message can carry links (see
 * lib/chat-links.ts), rendered here as underlined links that open in a new
 * tab; a member's message is always plain text, so nobody can dress up an
 * address as something it isn't in a coach's inbox.
 */
export function ChatBody({ body, linkify, className }: { body: string; linkify: boolean; className?: string }) {
  if (!linkify) return <span className={className}>{body}</span>;

  return (
    <span className={className}>
      {parseChatBody(body).map((part, i) =>
        part.type === "link" ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2 hover:opacity-80"
          >
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  );
}
