/**
 * Integration test for Clerk Auth functionality
 * This validates the auth-related files and their structure
 */

import fs from 'fs';
import path from 'path';
// Import Jest types helper
import '../setup-jest-types';

describe('Clerk Auth Integration', () => {
  test('auth-actions.ts implements protectRouteAction with redirect', () => {
    const actionsPath = path.join(process.cwd(), 'actions/auth-actions.ts');
    expect(fs.existsSync(actionsPath)).toBe(true);
    
    if (fs.existsSync(actionsPath)) {
      const actionsContent = fs.readFileSync(actionsPath, 'utf8');
      
      // Verify it has the protectRouteAction
      expect(actionsContent).toContain('protectRouteAction');
      
      // Verify it uses redirect for unauthenticated users
      expect(actionsContent).toContain('redirect("/login")');
    }
  });
  
  test('auth-related API routes are properly protected', () => {
    const middlewarePath = path.join(process.cwd(), 'middleware.ts');
    expect(fs.existsSync(middlewarePath)).toBe(true);
    
    if (fs.existsSync(middlewarePath)) {
      const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
      
      // Verify middleware protects routes
      expect(middlewareContent).toContain('auth.protect()');
      
      // Verify public routes are defined
      expect(middlewareContent).toContain('publicPaths');
      expect(middlewareContent).toContain('/login');
      expect(middlewareContent).toContain('/signup');
    }
  });
});