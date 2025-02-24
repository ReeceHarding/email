import { generateEmailContent, EmailTemplate } from '@/lib/content-generation';
import { BusinessData } from '@/lib/enhanced-scraper';
import { EnrichedTeamMember } from '@/lib/contact-research';
import OpenAI from 'openai';

// Set global Jest timeout to 30 seconds
jest.setTimeout(30000);

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'I noticed your company has been growing rapidly in the testing industry, and your innovative approach to testing services has been impressive.'
              }
            }
          ]
        })
      }
    }
  }));
});

describe('Content Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should generate personalized email content', async () => {
    // Mock business data
    const business: BusinessData = {
      name: 'Test Company',
      website: 'https://testcompany.com',
      description: 'A company that tests things',
      services: [
        { name: 'Testing Service 1' },
        { name: 'Testing Service 2' }
      ]
    };
    
    // Mock team member data
    const teamMember: EnrichedTeamMember = {
      name: 'Jane Smith',
      title: 'CTO',
      email: 'jane@testcompany.com',
      contactInfo: {
        email: 'jane@testcompany.com',
        linkedin: 'https://linkedin.com/in/janesmith',
        otherLinks: []
      },
      researchSummary: 'Jane is a technology leader with 10+ years experience.'
    };
    
    // Mock user info
    const userInfo = {
      name: 'John Sender',
      company: 'Sender Company',
      title: 'Sales Representative',
      email: 'john@sendercompany.com',
      phone: '(555) 123-4567'
    };
    
    // Get reference to the mocked function
    const mockedOpenAI = OpenAI as jest.MockedFunction<typeof OpenAI>;
    const mockInstance = mockedOpenAI();
    
    // Call the content generation function
    const email = await generateEmailContent(business, teamMember, userInfo);
    
    // Verify the email was generated
    expect(email).toBeDefined();
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.body.length).toBeGreaterThan(0);
    expect(email.recipientEmail).toBe('jane@testcompany.com');
    expect(email.recipientName).toBe('Jane Smith');
    
    // Verify variables
    expect(email.variables).toBeDefined();
    expect(email.variables.businessName).toBe('Test Company');
    expect(email.variables.recipientFirstName).toBe('Jane');
  });
  
  test('should handle errors and use fallback content', async () => {
    // Mock data
    const business: BusinessData = {
      name: 'Test Company',
      website: 'https://testcompany.com',
      services: [{ name: 'Testing Service' }]
    };
    
    const teamMember: EnrichedTeamMember = {
      name: 'Jane Smith',
      email: 'jane@testcompany.com'
    };
    
    const userInfo = {
      name: 'John Sender',
      company: 'Sender Company',
      title: 'Sales Rep',
      email: 'john@example.com',
      phone: '555-1234'
    };
    
    // Mock OpenAI to throw an error
    jest.mocked(OpenAI).mockImplementationOnce(() => ({
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('API Error'))
        }
      }
    } as any));
    
    // Call the content generation function
    const email = await generateEmailContent(business, teamMember, userInfo);
    
    // Verify the email was generated with fallback content
    expect(email).toBeDefined();
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.body.length).toBeGreaterThan(0);
  });
}); 