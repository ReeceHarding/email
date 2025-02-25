import { execSync } from 'child_process';
import '../setup-jest-types';

describe('Next.js Build Process', () => {
  // This test is marked as skipped by default because it can take time and is usually run as a separate step
  // Run it manually with: npm test -- -t "builds without errors"
  it.skip('should build Next.js application without errors', () => {
    // We're using try/catch here to handle potential build errors
    try {
      // Execute build command and capture output
      const output = execSync('npm run build', { 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000 // 5 minutes timeout
      });
      
      // Check if the output contains success messages
      expect(output.includes('Compiled successfully')).toBeTruthy();
      
      // The build succeeded if we get here
      expect(true).toBeTruthy();
    } catch (error: any) {
      // Log the error for debugging
      console.error('Build failed:', error.message);
      console.error('Build output:', error.stdout);
      
      // Fail the test
      expect(error).toBeNull();
    }
  });
  
  // This is a simpler test that just checks if the build script exists and is correctly defined
  it('should have Next.js build script correctly defined', () => {
    const packageJson = require('../../package.json');
    expect(packageJson.scripts.build === 'next build').toBeTruthy();
  });
}); 