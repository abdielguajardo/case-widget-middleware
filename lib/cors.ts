interface HeaderCarrier {
  getHeader(name: string): number | string | string[] | undefined;
  setHeader(name: string, value: number | string | readonly string[]): unknown;
}

function buildVaryValue(current: number | string | string[] | undefined): string {
  const values = new Set(
    (Array.isArray(current) ? current.join(",") : String(current ?? ""))
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  values.add("Origin");
  return Array.from(values).join(", ");
}

export function setCorsHeaders(
  res: HeaderCarrier,
  methods: string,
  origin?: string
): void {
  res.setHeader("Vary", buildVaryValue(res.getHeader("Vary")));
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", methods);

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
}
