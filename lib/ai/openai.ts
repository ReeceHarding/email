/**
 * OpenAI Client Implementation
 * 
 * A robust, type-safe wrapper for the OpenAI API with error handling,
 * retry logic, rate limiting, and configurable options.
 */
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import { encode } from 'gpt-tokenizer';
import 'dotenv/config';

// Custom error types for different failure modes
export class OpenAIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export class OpenAIAuthError extends OpenAIError {
  constructor(message = 'OpenAI API authentication failed') {
    super(message);
    this.name = 'OpenAIAuthError';
  }
}

export class OpenAIRateLimitError extends OpenAIError {
  constructor(message = 'OpenAI API rate limit exceeded') {
    super(message);
    this.name = 'OpenAIRateLimitError';
  }
}

export class OpenAITimeoutError extends OpenAIError {
  constructor(message = 'OpenAI API request timed out') {
    super(message);
    this.name = 'OpenAITimeoutError';
  }
}

export class OpenAIAbortError extends OpenAIError {
  constructor(message = 'OpenAI API request was aborted') {
    super(message);
    this.name = 'OpenAIAbortError';
  }
}

export class OpenAITokenLimitError extends OpenAIError {
  constructor(message = 'Request exceeds token limit') {
    super(message);
    this.name = 'OpenAITokenLimitError';
  }
}

// Type definitions
export interface OpenAIClientOptions {
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  defaultModel?: string;
  organization?: string;
  maxConcurrentRequests?: number;
  fallbackModel?: string;
}

export interface CompletionRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  abortSignal?: AbortSignal;
  priority?: 'high' | 'normal' | 'low';
}

export interface CompletionResponse {
  content: string;
  id: string;
  model: string;
  created: number;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

interface QueueItem {
  request: CompletionRequest;
  resolve: (value: CompletionResponse) => void;
  reject: (reason: any) => void;
  priority: number;
  timestamp: number;
}

// Token limits for different models
const MODEL_TOKEN_LIMITS: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-instruct': 4097,
};

// Default configuration
const DEFAULT_OPTIONS: Required<OpenAIClientOptions> = {
  apiKey: process.env.OPENAI_API_KEY || '',
  timeout: 60000, // 60 seconds
  maxRetries: 3,
  defaultModel: 'gpt-4o',
  organization: process.env.OPENAI_ORGANIZATION || '',
  maxConcurrentRequests: 5,
  fallbackModel: 'gpt-3.5-turbo', // Fallback to a less capable but more available model
};

/**
 * Calculate the exponential backoff time for retries
 */
function calculateBackoff(attempt: number, baseDelay = 1000, maxDelay = 30000): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter to avoid thundering herd problem
  return delay + Math.random() * 1000;
}

/**
 * Count tokens for a message array
 */
function countTokens(messages: Array<{ role: string; content: string }>): number {
  let totalTokens = 0;
  
  for (const message of messages) {
    // Base tokens for message formatting
    totalTokens += 4; // Format tax per message
    
    // Count tokens in content
    totalTokens += encode(message.content).length;
    
    // Count tokens in role (typically very small)
    totalTokens += encode(message.role).length;
  }
  
  // Add a small buffer for completion
  totalTokens += 3; // Final reply format tokens
  
  return totalTokens;
}

/**
 * OpenAI Client class
 */
export class OpenAIClient {
  private client: any;
  private options: Required<OpenAIClientOptions>;
  private requestQueue: QueueItem[] = [];
  private activeRequests = 0;
  private isProcessingQueue = false;
  private rateLimitResetTime: number | null = null;
  private requestHistory: { timestamp: number; tokens: number }[] = [];

  constructor(options: OpenAIClientOptions = {}) {
    // Merge provided options with defaults
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Validate API key
    if (!this.options.apiKey) {
      throw new OpenAIAuthError('OpenAI API key is required');
    }

    try {
      // Initialize OpenAI client
      this.client = new OpenAI({
        apiKey: this.options.apiKey,
        organization: this.options.organization || undefined,
        timeout: this.options.timeout,
        maxRetries: this.options.maxRetries,
      });

      console.log(`[OpenAI] Client initialized with model: ${this.options.defaultModel}`);
    } catch (error) {
      console.error('[OpenAI] Error initializing client:', error);
      throw new OpenAIAuthError('Failed to initialize OpenAI client');
    }
  }

  /**
   * Process the request queue
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0 || this.activeRequests >= this.options.maxConcurrentRequests) {
      return;
    }

    // Don't process if we're rate limited
    if (this.rateLimitResetTime && Date.now() < this.rateLimitResetTime) {
      const waitTime = this.rateLimitResetTime - Date.now();
      console.log(`[OpenAI] Rate limited, waiting ${Math.ceil(waitTime / 1000)} seconds`);
      setTimeout(() => this.processQueue(), waitTime);
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Sort queue by priority (higher number = higher priority)
      this.requestQueue.sort((a, b) => {
        // First by priority
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        // Then by timestamp (older first)
        return a.timestamp - b.timestamp;
      });

      // Process requests up to concurrent limit
      while (this.requestQueue.length > 0 && this.activeRequests < this.options.maxConcurrentRequests) {
        const item = this.requestQueue.shift();
        if (!item) continue;

        this.activeRequests++;
        this.executeRequest(item.request)
          .then(result => {
            item.resolve(result);
          })
          .catch(error => {
            item.reject(error);
          })
          .finally(() => {
            this.activeRequests--;
            this.processQueue();
          });
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Add a request to the queue
   */
  private queueRequest(request: CompletionRequest): Promise<CompletionResponse> {
    // Calculate priority based on the request's priority field
    const priorityMap = { high: 2, normal: 1, low: 0 };
    const priority = priorityMap[request.priority || 'normal'] || 1;

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        request,
        resolve,
        reject,
        priority,
        timestamp: Date.now()
      });

      // Start processing queue if not already
      setTimeout(() => this.processQueue(), 0);
    });
  }

  /**
   * Execute a completion request
   */
  private async executeRequest(request: CompletionRequest, attempt = 0): Promise<CompletionResponse> {
    const model = request.model || this.options.defaultModel;
    
    try {
      // Check token limit
      const messageTokens = countTokens(request.messages);
      const modelLimit = MODEL_TOKEN_LIMITS[model] || 16385; // Default to GPT-3.5 Turbo limit
      
      if (messageTokens > modelLimit * 0.9) { // Leave 10% for response
        throw new OpenAITokenLimitError(`Request with ${messageTokens} tokens exceeds limit for model ${model}`);
      }
      
      console.log(`[OpenAI] Sending completion request with model: ${model}`);
      
      // Prepare request parameters
      const params = {
        model,
        messages: request.messages.map(msg => ({ role: msg.role, content: msg.content })) as ChatCompletionMessageParam[],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
      };
      
      // Execute request with optional signal
      const response = await this.client.chat.completions.create(
        params,
        { signal: request.abortSignal }
      );
      
      console.log(`[OpenAI] Received completion response (${response.choices[0]?.message?.content?.length} chars)`);
      
      return {
        content: response.choices[0]?.message?.content || '',
        id: response.id,
        model: response.model,
        created: response.created,
        tokenUsage: {
          prompt: response.usage?.prompt_tokens || 0,
          completion: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0,
        }
      };
    } catch (error: any) {
      // Handle different error types
      console.error(`[OpenAI] Error in completion request: ${error.message}`);
      
      if (error.name === 'OpenAIAbortError') {
        throw error;
      }
      
      if (error.name === 'OpenAITokenLimitError') {
        throw error;
      }
      
      // Handle API errors
      if (error.status === 401 || error.status === 403) {
        throw new OpenAIAuthError('Authentication error with OpenAI API');
      }
      
      if (error.status === 429) {
        // Detect if this is a rate limit error
        const rateLimitError = new OpenAIRateLimitError();
        
        // If there's a retry header, use it to set the reset time
        const resetHeader = error.headers?.['x-ratelimit-reset-requests'] || error.headers?.['x-ratelimit-reset-tokens'];
        if (resetHeader) {
          const resetSeconds = parseInt(resetHeader, 10);
          if (resetSeconds) {
            this.rateLimitResetTime = Date.now() + resetSeconds * 1000;
          }
        } else {
          // If no reset header, set a default reset time
          this.rateLimitResetTime = Date.now() + calculateBackoff(attempt, 10000, 60000);
        }
        
        throw rateLimitError;
      }
      
      // If it's a timeout error
      if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
        throw new OpenAITimeoutError();
      }
      
      // Handle abort error specifically from AbortController
      if (error.name === 'AbortError') {
        throw new OpenAIAbortError();
      }
      
      // If we should retry the request
      if (attempt < this.options.maxRetries) {
        const backoff = calculateBackoff(attempt);
        console.log(`[OpenAI] Retrying after ${Math.floor(backoff / 1000)} seconds (attempt ${attempt + 1}/${this.options.maxRetries})`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, backoff));
        
        // Use fallback model if appropriate
        if (attempt === this.options.maxRetries - 1 && this.options.fallbackModel && model !== this.options.fallbackModel) {
          console.log(`[OpenAI] Falling back to ${this.options.fallbackModel} model`);
          return this.executeRequest({
            ...request,
            model: this.options.fallbackModel
          }, attempt + 1);
        }
        
        return this.executeRequest(request, attempt + 1);
      }
      
      // If retries are exhausted, throw a generic OpenAI error
      throw new OpenAIError(`OpenAI API error: ${error.message}`);
    }
  }

  /**
   * Execute a completion request to the OpenAI API with queuing and retries
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Queue the request (which will be processed based on priority)
    return this.queueRequest(request);
  }

  /**
   * Get current client status
   */
  getStatus() {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      rateLimited: this.rateLimitResetTime !== null && Date.now() < this.rateLimitResetTime,
      rateLimitResetTime: this.rateLimitResetTime,
      requestsInLastMinute: this.requestHistory.length,
      tokenUsageInLastMinute: this.requestHistory.reduce((sum, item) => sum + item.tokens, 0),
    };
  }
}

/**
 * Create a new OpenAI client with the provided options
 */
export function createOpenAIClient(options: OpenAIClientOptions = {}): OpenAIClient {
  return new OpenAIClient(options);
}

/**
 * Export the client as the default
 */
export default createOpenAIClient; 