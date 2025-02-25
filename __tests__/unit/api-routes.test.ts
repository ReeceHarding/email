/**
 * Unit tests for API Routes
 * These tests verify that the required API routes are properly structured
 */

import fs from 'fs';
import path from 'path';
import '../setup-jest-types';

describe('API Routes Structure', () => {
  const apiDir = path.join(process.cwd(), 'app/api');
  
  test('Required API directories exist', () => {
    // Check that the api directory exists
    expect(fs.existsSync(apiDir)).toBe(true);
    
    // Check for required API route directories
    const requiredDirs = [
      'auth',
      'search',
      'scrape',
      'email-gmail'
    ];
    
    for (const dir of requiredDirs) {
      expect(fs.existsSync(path.join(apiDir, dir))).toBe(true);
    }
  });
  
  test('User server actions exist', () => {
    const usersActionsPath = path.join(process.cwd(), 'actions/db/users-actions.ts');
    expect(fs.existsSync(usersActionsPath)).toBe(true);
    
    if (fs.existsSync(usersActionsPath)) {
      const content = fs.readFileSync(usersActionsPath, 'utf8');
      // Check for required user actions (or at least one)
      expect(content).toContain('checkGmailConnectionAction');
    }
  });
  
  test('Business profile actions exist', () => {
    const profilesActionsPath = path.join(process.cwd(), 'actions/db/business-profiles-actions.ts');
    expect(fs.existsSync(profilesActionsPath)).toBe(true);
    
    if (fs.existsSync(profilesActionsPath)) {
      const content = fs.readFileSync(profilesActionsPath, 'utf8');
      // Check for required business profile actions
      expect(content).toContain('createBusinessProfile');
      expect(content).toContain('updateBusinessProfile');
      expect(content).toContain('getBusinessProfile');
    }
  });
  
  test('Search and scrape actions exist', () => {
    // Check for search and scrape actions
    const searchActionsPath = path.join(process.cwd(), 'actions/search-scrape-actions.ts');
    expect(fs.existsSync(searchActionsPath)).toBe(true);
    
    if (fs.existsSync(searchActionsPath)) {
      const content = fs.readFileSync(searchActionsPath, 'utf8');
      expect(content).toContain('"use server"');
      // Check for some search/scrape functionality
      expect(content).toContain('search') || expect(content).toContain('scrape');
    }
  });
  
  test('Email actions exist', () => {
    // Check for search and scrape actions
    const gmailActionsPath = path.join(process.cwd(), 'actions/gmail-actions.ts');
    expect(fs.existsSync(gmailActionsPath)).toBe(true);
    
    if (fs.existsSync(gmailActionsPath)) {
      const content = fs.readFileSync(gmailActionsPath, 'utf8');
      expect(content).toContain('"use server"');
      // Check for some email functionality
      expect(content).toContain('gmail') || expect(content).toContain('email');
    }
  });
}); 