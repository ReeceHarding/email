import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// List of public paths that don't require authentication
const publicPaths = [
  "/",
  "/login",
  "/signup",
  "/api/auth(.*)", // Auth related API routes
  "/api/health",
  "/api/public(.*)", // Any API routes marked as public
];

// Create a route matcher for public routes
const isPublicRoute = createRouteMatcher(publicPaths);

export default clerkMiddleware((auth, request) => {
  // If the route is not public, protect it
  if (!isPublicRoute(request)) {
    // For API routes, this will return a 401 instead of redirecting
    auth.protect();
  }
});

// Define the paths that Clerk middleware will run on
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
