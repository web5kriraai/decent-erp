const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

type HeaderSource = { get(name: string): string | null };

/** Public origin from a reverse proxy, or null when the request is direct. */
export function publicOriginFrom(headers: HeaderSource): string | null {
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (!forwardedHost) return null;
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  return `${forwardedProto}://${forwardedHost}`;
}

/** Keep the path, but swap an internal localhost origin for the public one. */
export function rewriteLocalhostUrl(value: string, publicOrigin: string): string {
  try {
    const target = new URL(value);
    if (!LOCAL_HOSTS.has(target.hostname)) return value;
    return new URL(`${target.pathname}${target.search}${target.hash}`, publicOrigin).toString();
  } catch {
    return value;
  }
}

export function rewriteCallbackCookie(cookie: string, publicOrigin: string): string {
  return cookie.replace(
    /((?:__Secure-|__Host-)?authjs\.callback-url)=([^;]*)/,
    (_match, name: string, value: string) => {
      try {
        const decoded = decodeURIComponent(value);
        const rewritten = rewriteLocalhostUrl(decoded, publicOrigin);
        if (rewritten === decoded) return `${name}=${value}`;
        return `${name}=${encodeURIComponent(rewritten)}`;
      } catch {
        return `${name}=${value}`;
      }
    },
  );
}

/**
 * Auth.js pins redirects to NEXTAUTH_URL (localhost in dev). When the browser
 * arrived through ngrok, rewrite those absolute URLs onto the public host.
 */
export async function rewriteProxiedAuthResponse(request: Request, response: Response) {
  const origin = publicOriginFrom(request.headers);
  if (!origin) return response;

  const headers = new Headers(response.headers);
  const location = headers.get("location");
  if (location) headers.set("location", rewriteLocalhostUrl(location, origin));

  if (typeof headers.getSetCookie === "function") {
    const cookies = headers.getSetCookie();
    if (cookies.length > 0) {
      headers.delete("set-cookie");
      for (const cookie of cookies) {
        headers.append("set-cookie", rewriteCallbackCookie(cookie, origin));
      }
    }
  }

  const contentType = headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const text = await response.text();
  let body = text;
  try {
    const data = JSON.parse(text) as { url?: unknown };
    if (typeof data.url === "string") {
      data.url = rewriteLocalhostUrl(data.url, origin);
      body = JSON.stringify(data);
    }
  } catch {
    body = text;
  }

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
