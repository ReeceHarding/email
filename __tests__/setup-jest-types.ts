// This file extends Jest's types to support custom matchers and methods

// Make this file a module by adding an export
export {};

// Augment the Jest namespace
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledWith(...args: any[]): R;
      toEqual(expected: any): R;
      toHaveProperty(property: string, value?: any): R;
      toHaveLength(length: number): R;
      toBe(expected: any): R;
      toBeTruthy(): R;
      toBeGreaterThan(expected: number): R;
      toMatch(pattern: RegExp | string): R;
      toBeDefined(): R;
    }

    interface Expect {
      objectContaining<T>(obj: T): T;
      arrayContaining<T>(arr: T[]): T[];
      stringContaining(str: string): string;
      any(constructor: any): any;
    }

    interface ExpectStatic {
      objectContaining<T>(obj: T): T;
      arrayContaining<T>(arr: T[]): T[];
      stringContaining(str: string): string;
      any(constructor: any): any;
    }
  }
} 