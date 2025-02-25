import fs from 'fs';
import path from 'path';
import '../setup-jest-types';

describe('Project Dependencies', () => {
  let packageJson: any;
  
  beforeAll(() => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    packageJson = JSON.parse(packageJsonContent);
  });

  it('should have all required core dependencies', () => {
    const requiredDependencies = [
      '@clerk/nextjs',
      'next',
      'openai',
      'puppeteer',
      'cheerio',
      'axios',
      'drizzle-orm',
      '@supabase/supabase-js',
      'stripe',
      'posthog-js',
      'react',
      'react-dom',
      'typescript'
    ];

    requiredDependencies.forEach(dependency => {
      const dependencyExists = 
        packageJson.dependencies?.[dependency] !== undefined || 
        packageJson.devDependencies?.[dependency] !== undefined;
      expect(dependencyExists).toBeTruthy();
    });
  });

  it('should have all required dev dependencies', () => {
    const requiredDevDependencies = [
      'jest',
      'ts-jest',
      '@types/jest',
      'drizzle-kit'
    ];

    requiredDevDependencies.forEach(dependency => {
      expect(packageJson.devDependencies?.[dependency] !== undefined).toBeTruthy();
    });
  });

  it('should have Next.js build script', () => {
    expect(packageJson.scripts?.build === 'next build').toBeTruthy();
  });

  it('should have test scripts', () => {
    expect(packageJson.scripts?.test).toBeTruthy();
  });
  
  it('should have development script', () => {
    expect(packageJson.scripts?.dev).toBeTruthy();
  });
}); 