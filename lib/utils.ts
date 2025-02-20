/**
 * Utility function to create a delay
 * @param ms Delay in milliseconds
 * @returns Promise that resolves after the specified delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
} 