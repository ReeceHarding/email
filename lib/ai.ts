import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ScrapeResult {
  businessName?: string;
  contactEmail?: string;
  contactName?: string;
  phoneNumber?: string;
  address?: string;
  industry?: string;
  description?: string;
  websiteUrl: string;
}

export async function parseBusinessData(rawHtml: string): Promise<ScrapeResult> {
  const prompt = `Extract business information from this HTML. Return a JSON object with these fields if found:
  - businessName
  - contactEmail
  - contactName
  - phoneNumber
  - address
  - industry
  - description
  - websiteUrl (required)
  
  HTML:
  ${rawHtml}`;

  const response = await anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    const result = JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '{}');
    return {
      websiteUrl: result.websiteUrl || '',
      businessName: result.businessName,
      contactEmail: result.contactEmail,
      contactName: result.contactName,
      phoneNumber: result.phoneNumber,
      address: result.address,
      industry: result.industry,
      description: result.description,
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return { websiteUrl: '' };
  }
}

export async function draftEmailWithClaude(leadData: ScrapeResult): Promise<{ subject: string; body: string }> {
  const prompt = `Draft a personalized outreach email for this business:
  ${JSON.stringify(leadData, null, 2)}
  
  The email should be professional but friendly. Focus on value proposition.
  Return a JSON object with:
  - subject: Email subject line
  - body: Email body text`;

  const response = await anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    const result = JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '{}');
    return {
      subject: result.subject || 'Introduction',
      body: result.body || 'Hello, I wanted to reach out...',
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return {
      subject: 'Introduction',
      body: 'Hello, I wanted to reach out...',
    };
  }
} 