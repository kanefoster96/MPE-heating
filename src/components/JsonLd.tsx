// Renders a schema.org object as a JSON-LD <script> tag — the standard way
// to add structured data in Next.js (no built-in Metadata API support for
// it). JSON.stringify output is safe here: it's server-generated from our
// own typed content, never raw user input.
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
