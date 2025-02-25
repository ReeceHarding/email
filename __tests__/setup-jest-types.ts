/**
 * This file extends Jest's types to properly expose assertion methods to TypeScript.
 * Import this file in test files to resolve TypeScript errors with Jest's expect methods.
 */

// This empty export makes TypeScript treat this as a module
export {}

// Extend Jest's global types to include all assertion methods
declare global {
  namespace jest {
    interface Expect {
      toBeTruthy(): any
      toBe(expected: any): any
      toBeNull(): any
      toContain(expected: any): any
      toHaveBeenCalled(): any
      toHaveBeenCalledTimes(n: number): any
      toHaveBeenCalledWith(...args: any[]): any
      toBeDefined(): any
      toBeUndefined(): any
      toBeGreaterThan(n: number): any
      toBeGreaterThanOrEqual(n: number): any
      toEqual(expected: any): any
      toMatchObject(expected: object): any
      toThrow(expected?: string | Error | RegExp): any
    }
  }
} 