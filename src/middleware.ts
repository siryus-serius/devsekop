import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Lapisan middleware (bagian dari "DMZ" aplikasi):
 *  - Content-Security-Policy berbasis nonce per request (mitigasi XSS)
 *  - Penyegaran sesi Supabase (JWT) via cookie httpOnly
 *  - Gate autentikasi + MFA (AAL2) untuk area /issuer (REQ-03)
 *  - Proteksi CSRF berbasis Origin untuk /api (REQ-05)
 * Otorisasi peran yang sesungguhnya dilakukan di server (requireRole) dan RLS (REQ-06).
 */

const PROTECTED_PREFIXES = ["/issuer"];

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' ${supabase}${isDev ? " ws:" : ""}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** CSRF: request yang mengubah state wajib berasal dari origin aplikasi sendiri. */
function handleApi(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!["GET", "HEAD"].includes(request.method) && origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Origin tidak diizinkan." }, { status: 403 });
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const blocked = handleApi(request);
    if (blocked) return blocked;
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const forwardHeaders = () => {
    const h = new Headers(request.headers);
    h.set("x-nonce", nonce);
    h.set("Content-Security-Policy", csp);
    return h;
  };

  let response = NextResponse.next({ request: { headers: forwardHeaders() } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: forwardHeaders() } });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() memvalidasi JWT ke server Auth (tidak hanya membaca cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (needsAuth || pathname === "/mfa") {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    if (needsAuth) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel !== "aal2") {
        const url = request.nextUrl.clone();
        url.pathname = "/mfa";
        url.search = `?next=${encodeURIComponent(pathname)}`;
        return NextResponse.redirect(url);
      }
    }
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Lewati aset statis & prefetch agar nonce tidak dihitung ulang tanpa perlu.
    {
      source: "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/health).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
