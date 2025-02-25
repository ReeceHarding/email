import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Helper functions
function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

const middlewarePath = path.join(process.cwd(), 'middleware.ts');
const authDirPath = path.join(process.cwd(), 'app', 'sign-in');
const authComponentsPath = path.join(process.cwd(), 'components', 'auth');

describe('Authentication Integration', () => {
  test('Authentication middleware file exists', () => {
    expect(fileExists(middlewarePath)).toBe(true);
    
    if (fileExists(middlewarePath)) {
      const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
      // Verify that middleware imports auth-related functions
      expect(middlewareContent).toContain('clerk');
      expect(middlewareContent).toContain('public'); // Public routes definition
    }
  });

  test('Authentication routes exist', () => {
    // Check sign-in directory exists
    expect(fileExists(authDirPath)).toBe(true);
    
    // Check sign-up directory exists
    expect(fileExists(path.join(process.cwd(), 'app', 'sign-up'))).toBe(true);
  });

  test('Authentication components exist', () => {
    // If there's a dedicated auth components directory
    if (fileExists(authComponentsPath)) {
      const files = fs.readdirSync(authComponentsPath);
      expect(files.length).toBeGreaterThan(0);
    } else {
      // Check individual auth components in UI directory
      const uiPath = path.join(process.cwd(), 'components', 'ui');
      if (fileExists(uiPath)) {
        const files = fs.readdirSync(uiPath);
        // Should find at least one auth-related component
        const hasAuthComponent = files.some(file => 
          file.includes('auth') || file.includes('sign-in') || file.includes('user'));
        expect(hasAuthComponent).toBe(true);
      }
    }
  });

  test('Environment variables for authentication are set up', () => {
    const envExamplePath = path.join(process.cwd(), '.env.example');
    
    if (fileExists(envExamplePath)) {
      const envContent = fs.readFileSync(envExamplePath, 'utf8');
      // Check for Clerk-related environment variables
      expect(envContent).toContain('CLERK');
    }
  });
}); 