export function normalizeDomain(input: string | null | undefined): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`
    );
    const hostname = url.hostname.replace(/\.+$/, "");
    return hostname || null;
  } catch {
    return null;
  }
}
