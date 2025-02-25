/**
 * Global TypeScript declarations for Jest expect matchers
 */

declare global {
  // Augment the expect global type to include Jest matchers
  namespace jest {
    interface Matchers<R> {
      toBeTruthy(): R;
      toBe(expected: any): R;
      toBeNull(): R;
      toContain(expected: any): R;
      toHaveBeenCalled(): R;
      toHaveBeenCalledTimes(n: number): R;
      toHaveBeenCalledWith(...args: any[]): R;
      toBeDefined(): R;
      toBeUndefined(): R;
      toBeGreaterThan(n: number): R;
      toBeGreaterThanOrEqual(n: number): R;
      toEqual(expected: any): R;
      toMatchObject(expected: object): R;
      toThrow(expected?: string | Error | RegExp): R;
      toContainEqual(expected: any): R;
      toHaveProperty(path: string, value?: any): R;
      toBeInstanceOf(expected: any): R;
      toHaveLength(expected: number): R;
      toMatch(expected: RegExp | string): R;
      not: Matchers<R>;
    }

    interface Expect {
      stringContaining(str: string): any;
      objectContaining(obj: object): any;
      arrayContaining(arr: any[]): any;
      any(constructor: any): any;
      stringMatching(expected: string | RegExp): any;
    }

    interface ExpectStatic extends Expect {
      <T = any>(actual: T): Matchers<void>;
      assertions(count: number): void;
      extend(matchers: Record<string, any>): void;
      hasAssertions(): void;
      stringContaining(str: string): any;
      objectContaining(obj: object): any;
      arrayContaining(arr: any[]): any;
      any(constructor: any): any;
      stringMatching(expected: string | RegExp): any;
    }

    // Add support for mocked interfaces
    interface MockedFunction<T extends (...args: any[]) => any> {
      (...args: Parameters<T>): ReturnType<T>;
      mockClear(): MockedFunction<T>;
      mockReset(): MockedFunction<T>;
      mockImplementation(fn: (...args: Parameters<T>) => ReturnType<T>): MockedFunction<T>;
      mockImplementationOnce(fn: (...args: Parameters<T>) => ReturnType<T>): MockedFunction<T>;
      mockReturnValue(value: ReturnType<T>): MockedFunction<T>;
      mockReturnValueOnce(value: ReturnType<T>): MockedFunction<T>;
      mockResolvedValue<U extends Promise<unknown>>(value: any): MockedFunction<T>;
      mockResolvedValueOnce<U extends Promise<unknown>>(value: any): MockedFunction<T>;
      mockRejectedValue(value: unknown): MockedFunction<T>;
      mockRejectedValueOnce(value: unknown): MockedFunction<T>;
      getMockName(): string;
      mockName(name: string): MockedFunction<T>;
      mock: {
        calls: Array<Parameters<T>>;
        instances: Array<T>;
        invocationCallOrder: Array<number>;
        results: Array<{ type: string; value: any }>;
        lastCall: Parameters<T>;
      };
    }

    interface Mocked<T> {
      [K in keyof T]: T[K] extends (...args: any[]) => any
        ? MockedFunction<T[K]>
        : T[K];
    }

    function mocked<T>(item: T, deep?: boolean): Mocked<T>;
  }

  // Global types for expect
  var expect: jest.ExpectStatic;
}

// This empty export makes TypeScript treat this as a module
export {}; 