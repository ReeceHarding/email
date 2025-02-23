import { authMiddleware } from "@clerk/nextjs";

const publicRoutes = [
  "/(.*)",  // Allow all routes
  "/",
  "/login", 
  "/signup",
  "/api/search/generate-queries-stream",
  "/api/search/scrape-stream",
  "/api/track",
  "/api/stripe-webhook"
];

export default authMiddleware({
  publicRoutes,
  ignoredRoutes: []
});

export const config = {
  matcher: ["/((?!.*\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
