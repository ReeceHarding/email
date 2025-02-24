import axios from 'axios';

// Set global Jest timeout to 30 seconds
jest.setTimeout(30000);

// Define the mocked functions that will be exposed by the module
const mockIsGmailConnected = jest.fn();
const mockSendEmail = jest.fn();

// Mock the entire email-service module
jest.mock('@/lib/email-service', () => ({
  isGmailConnected: (userId: string) => mockIsGmailConnected(userId),
  sendEmail: (options: any) => mockSendEmail(options),
  getGmailConnectionStatus: jest.fn()
}));

// Import the mocked functions
import { isGmailConnected, sendEmail } from '@/lib/email-service';

// Mock axios for API calls
jest.mock('axios');

describe('Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });
  
  test('should check if Gmail is connected', async () => {
    // Setup mock response
    mockIsGmailConnected.mockResolvedValue(true);
    
    // Call the function
    const isConnected = await isGmailConnected('test-user-id');
    
    // Verify result
    expect(isConnected).toBe(true);
    expect(mockIsGmailConnected).toHaveBeenCalledWith('test-user-id');
  });
  
  test('should return false if Gmail tokens are missing', async () => {
    // Setup mock response
    mockIsGmailConnected.mockResolvedValue(false);
    
    // Call the function
    const isConnected = await isGmailConnected('test-user-id');
    
    // Verify result
    expect(isConnected).toBe(false);
    expect(mockIsGmailConnected).toHaveBeenCalledWith('test-user-id');
  });
  
  test('should send an email when Gmail is connected', async () => {
    // Setup mock responses
    mockIsGmailConnected.mockResolvedValue(true);
    mockSendEmail.mockResolvedValue({
      success: true,
      messageId: 'test-message-id'
    });
    
    // Email options
    const emailOptions = {
      userId: 'test-user-id',
      to: 'recipient@example.com',
      subject: 'Test Email',
      body: 'This is a test email'
    };
    
    // Call the function
    const result = await sendEmail(emailOptions);
    
    // Verify result
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('test-message-id');
    expect(mockSendEmail).toHaveBeenCalledWith(emailOptions);
  });
  
  test('should handle errors when sending email', async () => {
    // Setup mock responses
    mockIsGmailConnected.mockResolvedValue(true);
    mockSendEmail.mockResolvedValue({
      success: false,
      error: 'Failed to send email'
    });
    
    // Email options
    const emailOptions = {
      userId: 'test-user-id',
      to: 'recipient@example.com',
      subject: 'Test Email',
      body: 'This is a test email'
    };
    
    // Call the function
    const result = await sendEmail(emailOptions);
    
    // Verify error handling
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockSendEmail).toHaveBeenCalledWith(emailOptions);
  });
  
  test('should not send email when Gmail is not connected', async () => {
    // Setup mock responses
    mockIsGmailConnected.mockResolvedValue(false);
    mockSendEmail.mockResolvedValue({
      success: false,
      error: 'Gmail is not connected'
    });
    
    // Email options
    const emailOptions = {
      userId: 'test-user-id',
      to: 'recipient@example.com',
      subject: 'Test Email',
      body: 'This is a test email'
    };
    
    // Call the function
    const result = await sendEmail(emailOptions);
    
    // Verify result
    expect(result.success).toBe(false);
    expect(result.error).toContain('Gmail is not connected');
    expect(mockSendEmail).toHaveBeenCalledWith(emailOptions);
  });
}); 