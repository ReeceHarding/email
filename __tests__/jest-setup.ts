// Basic setup file for Jest
// We're not adding any custom matchers or type extensions here
// to avoid TypeScript errors with the test suite

// This is just a placeholder file that Jest will use
// The actual type definitions for Jest matchers are handled by @types/jest

// If you need to add custom matchers or setup,
// add them here after resolving the TypeScript configuration

import '@testing-library/jest-dom';

// This file extends Jest's expect with custom matchers for DOM elements
// Adding proper TypeScript typings for Jest

// Setup global mocks if needed
global.console = {
  ...console,
  // Uncomment to ignore specific console outputs during tests
  // log: jest.fn(),
  // error: jest.fn(),
  // warn: jest.fn(),
};

// Fix TypeScript errors with Jest expect
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalled(): R;
      toHaveBeenCalledTimes(n: number): R;
      toHaveBeenCalledWith(...args: any[]): R;
      toBe(expected: any): R;
      toBeDefined(): R;
      toBeGreaterThan(n: number): R;
      toBeGreaterThanOrEqual(n: number): R;
      toBeUndefined(): R;
      toContain(item: any): R;
      toEqual(expected: any): R;
      toHaveLength(expected: number): R;
      toMatch(expected: string | RegExp): R;
      toMatchObject(expected: object): R;
      toThrow(expected?: string | Error | RegExp): R;
    }
  }

  // Extend the ExpectStatic interface
  interface ExpectStatic {
    any(constructor: any): any;
    anything(): any;
    arrayContaining(arr: any[]): any;
    objectContaining(obj: object): any;
    stringContaining(str: string): any;
    stringMatching(str: string | RegExp): any;
  }
}

// This empty export is needed to make TypeScript treat this as a module
export {}; 