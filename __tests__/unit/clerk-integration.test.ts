import fs from 'fs';
import path from 'path';

/**
 * Tests for Clerk authentication integration.
 * These tests verify that the required files and components for Clerk auth
 * are present and properly implemented.
 */
describe('Clerk Authentication Integration', () => {
  test('middleware.ts file is properly configured for Clerk integration', () => {
    const middlewarePath = path.join(process.cwd(), 'middleware.ts');
    
    // Verify middleware file exists
    expect(fs.existsSync(middlewarePath)).toBe(true);
    
    if (fs.existsSync(middlewarePath)) {
      const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
      
      // Verify it's using clerkMiddleware from Clerk
      expect(middlewareContent).toContain('clerkMiddleware');
      
      // Verify it's properly protecting routes
      expect(middlewareContent).toContain('auth.protect');
      
      // Verify it has the matcher config
      expect(middlewareContent).toContain('export const config');
    }
  });

  test('clerk-utils.ts has required authentication utilities', () => {
    const clerkUtilsPath = path.join(process.cwd(), 'lib/clerk-utils.ts');
    
    // Verify file exists
    expect(fs.existsSync(clerkUtilsPath)).toBe(true);
    
    if (fs.existsSync(clerkUtilsPath)) {
      const utilsContent = fs.readFileSync(clerkUtilsPath, 'utf8');
      
      // Verify it has the essential functions
      expect(utilsContent).toContain('getCurrentUser');
      expect(utilsContent).toContain('getAuth');
      expect(utilsContent).toContain('getUserId');
      expect(utilsContent).toContain('isAuthenticated');
    }
  });

  test('auth-actions.ts implements required server actions', () => {
    const authActionsPath = path.join(process.cwd(), 'actions/auth-actions.ts');
    
    // Verify file exists
    expect(fs.existsSync(authActionsPath)).toBe(true);
    
    if (fs.existsSync(authActionsPath)) {
      const authContent = fs.readFileSync(authActionsPath, 'utf8');
      
      // Verify it has the essential auth actions
      expect(authContent).toContain('getCurrentUserAction');
      expect(authContent).toContain('signOutAction');
      expect(authContent).toContain('protectRouteAction');
      expect(authContent).toContain('"use server"');
    }
  });

  test('authentication pages are properly implemented', () => {
    // Check sign-in page
    const signInPath = path.join(process.cwd(), 'app/sign-in/page.tsx');
    expect(fs.existsSync(signInPath)).toBe(true);
    
    // Check sign-up page
    const signUpPath = path.join(process.cwd(), 'app/sign-up/page.tsx');
    expect(fs.existsSync(signUpPath)).toBe(true);
    
    // Check login page
    const loginPath = path.join(process.cwd(), 'app/login/page.tsx');
    expect(fs.existsSync(loginPath)).toBe(true);
    
    // Check signup page
    const signupPath = path.join(process.cwd(), 'app/signup/page.tsx');
    expect(fs.existsSync(signupPath)).toBe(true);

    // Verify login page uses Clerk components
    if (fs.existsSync(loginPath)) {
      const loginContent = fs.readFileSync(loginPath, 'utf8');
      expect(loginContent).toContain('SignIn');
      expect(loginContent).toContain('@clerk/nextjs');
    }

    // Verify signup page uses Clerk components
    if (fs.existsSync(signupPath)) {
      const signupContent = fs.readFileSync(signupPath, 'utf8');
      expect(signupContent).toContain('SignUp');
      expect(signupContent).toContain('@clerk/nextjs');
    }
  });
});