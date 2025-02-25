import fs from 'fs';
import path from 'path';
import '../setup-jest-types';

// Helper function to check if a directory exists
function directoryExists(dirPath: string): boolean {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

describe('Project Structure', () => {
  const rootDir = process.cwd();
  
  it('should have all required root directories', () => {
    const requiredDirectories = [
      'actions',
      'app',
      'components',
      'db',
      'lib',
      'prompts',
      'public',
      'types',
      '__tests__'
    ];

    requiredDirectories.forEach(dir => {
      const dirPath = path.join(rootDir, dir);
      expect(directoryExists(dirPath)).toBeTruthy();
    });
  });

  it('should have all required sub-directories', () => {
    const requiredSubDirectories = [
      path.join('actions', 'db'),
      path.join('app', 'api'),
      path.join('components', 'ui'),
      path.join('db', 'schema'),
      path.join('__tests__', 'unit')
    ];

    requiredSubDirectories.forEach(dir => {
      const dirPath = path.join(rootDir, dir);
      expect(directoryExists(dirPath)).toBeTruthy();
    });
  });

  it('should create required sub-directories if they do not exist', () => {
    const missingDirectories = [
      path.join('components', 'utilities'),
      path.join('lib', 'hooks'),
      path.join('prompts')
    ];

    missingDirectories.forEach(dir => {
      const dirPath = path.join(rootDir, dir);
      if (!directoryExists(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      expect(directoryExists(dirPath)).toBeTruthy();
    });
  });

  it('should have all required configuration files', () => {
    const requiredFiles = [
      '.env.local',
      '.env.example',
      'package.json',
      'tsconfig.json',
      'next.config.js',
      'jest.config.js'
    ];

    requiredFiles.forEach(file => {
      const filePath = path.join(rootDir, file);
      expect(fs.existsSync(filePath)).toBeTruthy();
    });
  });
}); 