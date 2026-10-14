/**
 * Structured data (schema.org JSON-LD). `<` is escaped so user-supplied names can never close
 * the script element. Only fields that are public by law belong here (FR-REG-003).
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
