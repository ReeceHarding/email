import { NextResponse, type NextRequest } from "next/server";

// List of paths that require authentication
const PROTECTED_PATHS = [
  "/dashboard",
  "/api/email-gmail/oauth-callback"
];

// List of paths that should never be protected
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/health",
  "/",
  "/_next", // Next.js assets
  "/favicon.ico",
];

/**
 * Middleware function that runs before each request
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Check if the path is public
  if (PUBLIC_PATHS.some(publicPath => path.startsWith(publicPath))) {
    return NextResponse.next();
  }
  
  // Check if the path is protected
  if (PROTECTED_PATHS.some(protectedPath => path.startsWith(protectedPath))) {
    const sessionCookie = request.cookies.get("app_session");
    
    // If there's no session cookie, redirect to login
    if (!sessionCookie?.value) {
      console.log("[middleware] No session cookie, redirecting to login");
      
      // For API routes, return unauthorized
      if (path.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      
      // For other routes, redirect to login
      const url = new URL("/login", request.url);
      url.searchParams.set("redirect", path);
      return NextResponse.redirect(url);
    }
  }
  
  return NextResponse.next();
}

/**
 * Configure the middleware to only run on specific paths
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
