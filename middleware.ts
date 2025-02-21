import { authMiddleware } from "@clerk/nextjs";

const publicRoutes = ["/", "/login", "/signup"];

export default authMiddleware({
  publicRoutes,
  ignoredRoutes: ["/api/track", "/api/stripe-webhook"]
});

export const config = {
  matcher: ["/((?!.*\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
