import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// We simply proceed with all requests
export function middleware(req: NextRequest) {
  console.log("[middleware] Bypassing Clerk / ignoring auth, continuing request to:", req.url);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
