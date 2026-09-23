export function sameRequestOrigin(request: Request) {
  const supplied = request.headers.get("origin");
  if (!supplied) return true;
  try {
    if (supplied === new URL(request.url).origin) return true;
    const protocol = firstHeaderValue(request.headers.get("x-forwarded-proto"));
    const host = firstHeaderValue(request.headers.get("x-forwarded-host")) || firstHeaderValue(request.headers.get("host"));
    if (!protocol || !host || !["http", "https"].includes(protocol)) return false;
    if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host)) return false;
    return supplied === new URL(`${protocol}://${host}`).origin;
  } catch {
    return false;
  }
}

function firstHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim().toLowerCase() || "";
}
