/** The kinds of file and certificate (lib/job-files.ts), safe to use in the browser. */
export type FileKind = "photo" | "certificate";
export const CERT_TYPES = ["gas_safety", "service", "benchmark", "commissioning", "other"] as const;
export type CertType = (typeof CERT_TYPES)[number];
export const CERT_LABEL: Record<CertType, string> = {
  gas_safety: "Gas safety record",
  service: "Service record",
  benchmark: "Benchmark checklist",
  commissioning: "Commissioning certificate",
  other: "Certificate",
};
