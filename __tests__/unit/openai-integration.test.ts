/**
 * OpenAI Integration Tests
 * 
 * These tests verify the proper functioning of the OpenAI client integration:
 * - Client initialization with API key
 * - Error handling when API key is missing
 * - Configuration options acceptance
 * - Successful completion of a simple request
 * - API error handling 
 * - Request cancellation using an abort controller
 */

// Import Jest types setup to fix TypeScript errors with assertions
import '../setup-jest-types';
import { 
  OpenAIClient, 
  createOpenAIClient, 
  OpenAIAuthError,
  OpenAIRateLimitError,
  OpenAIAbortError
} from '../../lib/ai/openai';

// Add type for extended Error with status property
interface ApiError extends Error {
  status?: number;
}

// Mock function for OpenAI API calls
const mockCreateMethod = jest.fn();

// Mock the OpenAI module
jest.mock('openai', () => {
  // Create a class that will be used as a constructor with proper type annotations
  class MockOpenAI {
    apiKey: string;
    organization: string | undefined;
    timeout: number;
    maxRetries: number;
    chat: { completions: { create: jest.Mock } };
    
    constructor(config: any) {
      this.apiKey = config.apiKey;
      this.organization = config.organization;
      this.timeout = config.timeout;
      this.maxRetries = config.maxRetries;
      
      this.chat = {
        completions: {
          create: mockCreateMethod
        }
      };
    }
  }
  
  // Return MockOpenAI directly to match how it's imported in the actual code
  return MockOpenAI;
});

describe('OpenAI Integration', () => {
  // Store the original env vars to restore after tests
  const originalEnv = { ...process.env };
  
  // Mock response for successful API calls
  const mockResponse = {
    id: 'test-id',
    created: 1615221580,
    model: 'gpt-4o',
    choices: [
      {
        message: {
          content: 'This is a test response',
          role: 'assistant',
        },
        finish_reason: 'stop',
        index: 0,
      },
    ],
    usage: {
      prompt_tokens: 20,
      completion_tokens: 10,
      total_tokens: 30
    }
  };

  // Setup before each test
  beforeEach(() => {
    // Reset environment variables for clean tests
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.OPENAI_ORGANIZATION = 'test-org';
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Set up the mock to return our test response
    mockCreateMethod.mockResolvedValue(mockResponse);
  });

  // Cleanup after each test
  afterEach(() => {
    // Restore the original env vars
    process.env = { ...originalEnv };
  });

  describe('Initialization', () => {
    it('should initialize with API key from environment variables', () => {
      // Arrange & Act
      const client = createOpenAIClient();
      
      // Assert
      expect(client).toBeInstanceOf(OpenAIClient);
    });

    it('should throw an error when API key is missing', () => {
      // Arrange
      delete process.env.OPENAI_API_KEY;
      
      // Override the default in the client
      jest.mock('../../lib/ai/openai', () => {
        const original = jest.requireActual('../../lib/ai/openai');
        return {
          ...original,
          DEFAULT_OPTIONS: { 
            ...original.DEFAULT_OPTIONS,
            apiKey: '' // Force empty API key
          }
        };
      });
      
      // Act & Assert
      expect(() => createOpenAIClient({ apiKey: '' })).toThrow(OpenAIAuthError);
    });

    it('should accept configuration options', () => {
      // Arrange
      const options = {
        apiKey: 'custom-api-key',
        timeout: 30000,
        maxRetries: 5,
        defaultModel: 'gpt-4-turbo',
        organization: 'custom-org'
      };
      
      // Act
      const client = createOpenAIClient(options);
      
      // Assert
      expect(client).toBeInstanceOf(OpenAIClient);
      // Just check the client was created, we can't easily inspect the private options
    });
  });

  describe('API Requests', () => {
    it('should successfully complete a simple request', async () => {
      // Arrange
      const client = createOpenAIClient();
      const request = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello, world!' }
        ]
      };
      
      // Act
      const response = await client.complete(request);
      
      // Assert
      expect(response.content).toBe('This is a test response');
      expect(response.id).toBe('test-id');
      expect(response.model).toBe('gpt-4o');
    });

    it('should handle API errors with specific error types', async () => {
      // Arrange
      const client = createOpenAIClient();
      const mockError: ApiError = new Error('API rate limit exceeded');
      mockError.status = 429;
      
      // Setup the mock to reject
      mockCreateMethod.mockRejectedValueOnce(mockError);
      
      // Act & Assert
      await expect(client.complete({
        messages: [{ role: 'user', content: 'Hello' }]
      })).rejects.toThrow(OpenAIRateLimitError);
    });

    it('should support request cancellation with AbortController', async () => {
      // Arrange
      const client = createOpenAIClient();
      
      // Create a mock error for abort
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';
      
      // Setup the mock to check for abort signal and reject if aborted
      mockCreateMethod.mockImplementationOnce(
        (_: any, options: { signal?: AbortSignal }) => {
          if (options.signal?.aborted) {
            return Promise.reject(abortError);
          }
          return Promise.resolve(mockResponse);
        }
      );
      
      // Create an abort controller and abort immediately
      const controller = new AbortController();
      controller.abort();
      
      // Act & Assert
      await expect(client.complete({
        messages: [{ role: 'user', content: 'Hello' }],
        abortSignal: controller.signal
      })).rejects.toThrow(OpenAIAbortError);
    });
  });
}); 