import OpenAI from 'openai';
import { BusinessData } from './enhanced-scraper';
import { EnrichedTeamMember } from './contact-research';
import "dotenv/config";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  tone: 'professional' | 'friendly' | 'direct' | 'personalized';
  purpose: 'introduction' | 'followup' | 'proposal' | 'demo' | 'general';
  variables: string[]; // The template variables like {{firstName}}, {{companyName}}
}

export interface EmailVariables {
  recipientFirstName?: string;
  recipientLastName?: string;
  recipientFullName?: string;
  recipientEmail?: string;
  recipientTitle?: string;
  recipientCompany?: string;
  businessName?: string;
  businessDescription?: string;
  businessServices?: string;
  businessLocation?: string;
  personalizedInsight?: string;
  senderName?: string;
  senderCompany?: string;
  senderTitle?: string;
  senderEmail?: string;
  senderPhone?: string;
  [key: string]: string | undefined;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  recipientEmail?: string;
  recipientName?: string;
  variables: EmailVariables;
}

// Sample email templates
const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'intro-professional',
    name: 'Professional Introduction',
    subject: 'Regarding {{businessName}} and potential collaboration',
    body: `Dear {{recipientFirstName}},

I hope this email finds you well. My name is {{senderName}} from {{senderCompany}}, and I'm reaching out after coming across {{businessName}}.

{{personalizedInsight}}

I'd love to discuss how {{senderCompany}} could potentially help {{businessName}} with {{businessServices}}. Would you be available for a brief 15-minute call next week to explore this further?

Best regards,
{{senderName}}
{{senderTitle}}
{{senderCompany}}
{{senderPhone}}`,
    tone: 'professional',
    purpose: 'introduction',
    variables: ['recipientFirstName', 'businessName', 'personalizedInsight', 'businessServices', 'senderName', 'senderCompany', 'senderTitle', 'senderPhone']
  },
  {
    id: 'direct-proposal',
    name: 'Direct Proposal',
    subject: 'Specific solution for {{businessName}} to improve {{businessServices}}',
    body: `Hi {{recipientFirstName}},

I noticed that {{businessName}} is focused on {{businessServices}}. Based on what I've learned about your business, I have a specific idea that could help you improve your results.

{{personalizedInsight}}

This approach has worked well for similar businesses in your industry. I'd be happy to share more details in a quick call.

Are you free for a 15-minute chat this week?

Thanks,
{{senderName}}
{{senderTitle}}
{{senderCompany}}
{{senderPhone}}`,
    tone: 'direct',
    purpose: 'proposal',
    variables: ['recipientFirstName', 'businessName', 'businessServices', 'personalizedInsight', 'senderName', 'senderTitle', 'senderCompany', 'senderPhone']
  },
  {
    id: 'friendly-followup',
    name: 'Friendly Follow-up',
    subject: 'Following up on {{businessName}}',
    body: `Hi {{recipientFirstName}},

I hope you're having a great week! I reached out a while ago about {{businessName}} and wanted to follow up.

I've been thinking more about {{businessServices}} at {{businessName}}, and I had a few additional ideas that might be helpful.

{{personalizedInsight}}

I'd love to hear your thoughts. Would you be open to a brief conversation later this week?

Best,
{{senderName}}
{{senderTitle}}
{{senderCompany}}
{{senderPhone}}`,
    tone: 'friendly',
    purpose: 'followup',
    variables: ['recipientFirstName', 'businessName', 'businessServices', 'personalizedInsight', 'senderName', 'senderTitle', 'senderCompany', 'senderPhone']
  }
];

/**
 * Main function to generate personalized email content
 */
export async function generateEmailContent(
  business: BusinessData,
  targetContact: EnrichedTeamMember,
  userInfo: {
    name: string;
    company: string;
    title: string;
    email: string;
    phone: string;
  },
  templateId?: string
): Promise<GeneratedEmail> {
  console.log(`[ContentGeneration] Generating email for ${targetContact.name} at ${business.name}`);
  
  // Get the right template
  const template = templateId 
    ? EMAIL_TEMPLATES.find(t => t.id === templateId) 
    : selectBestTemplate(business, targetContact);
  
  if (!template) {
    throw new Error(`Template with ID ${templateId} not found`);
  }
  
  // Prepare variables for template
  const variables = await prepareEmailVariables(business, targetContact, userInfo);
  
  // Generate a personalized insight if needed
  if (template.variables.includes('personalizedInsight') && !variables.personalizedInsight) {
    variables.personalizedInsight = await generatePersonalizedInsight(business, targetContact);
  }
  
  // Fill in the template
  const subject = fillTemplateVariables(template.subject, variables);
  const body = fillTemplateVariables(template.body, variables);
  
  // Enhance the content with AI if needed (for high-value contacts)
  const enhancedEmail = await enhanceEmailContent({
    subject,
    body,
    recipientEmail: targetContact.email,
    recipientName: targetContact.name,
    variables
  }, template.tone);
  
  return enhancedEmail;
}

/**
 * Select the best template based on the business and contact
 */
function selectBestTemplate(
  business: BusinessData,
  contact: EnrichedTeamMember
): EmailTemplate {
  // Logic to select the best template based on the business and contact
  // This could be enhanced with more sophisticated rules
  
  // Default to professional introduction
  let bestTemplateId = 'intro-professional';
  
  // If we have detailed information about the contact, use more personalized template
  if (contact.contactInfo?.professional_details?.role || 
      contact.contactInfo?.professional_details?.experience?.length) {
    bestTemplateId = 'direct-proposal';
  }
  
  // Find the template
  const template = EMAIL_TEMPLATES.find(t => t.id === bestTemplateId);
  
  // Fallback to first template if not found
  return template || EMAIL_TEMPLATES[0];
}

/**
 * Prepare variables for email template
 */
async function prepareEmailVariables(
  business: BusinessData,
  contact: EnrichedTeamMember,
  userInfo: {
    name: string;
    company: string;
    title: string;
    email: string;
    phone: string;
  }
): Promise<EmailVariables> {
  // Split name into first and last
  const nameParts = contact.name.split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
  
  // Format business services
  const services = business.services 
    ? business.services.map(s => s.name).join(', ')
    : '';
  
  // Create variables object
  const variables: EmailVariables = {
    recipientFirstName: firstName,
    recipientLastName: lastName,
    recipientFullName: contact.name,
    recipientEmail: contact.email,
    recipientTitle: contact.title,
    recipientCompany: business.name,
    businessName: business.name,
    businessDescription: business.description,
    businessServices: services,
    businessLocation: business.address,
    senderName: userInfo.name,
    senderCompany: userInfo.company,
    senderTitle: userInfo.title,
    senderEmail: userInfo.email,
    senderPhone: userInfo.phone
  };
  
  return variables;
}

/**
 * Fill in template variables with actual values
 */
function fillTemplateVariables(
  template: string,
  variables: EmailVariables
): string {
  let filled = template;
  
  // Replace all variables in the template
  for (const [key, value] of Object.entries(variables)) {
    if (value) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      filled = filled.replace(regex, value);
    }
  }
  
  // Remove any remaining template variables
  filled = filled.replace(/{{[^{}]+}}/g, '');
  
  return filled;
}

/**
 * Generate a personalized insight based on business and contact info
 */
async function generatePersonalizedInsight(
  business: BusinessData,
  contact: EnrichedTeamMember
): Promise<string> {
  try {
    // Convert business data and contact info to JSON for the prompt
    const businessJSON = JSON.stringify({
      name: business.name,
      description: business.description,
      services: business.services,
      specialties: business.specialties,
      companyValues: business.companyValues,
      teamMembers: business.teamMembers?.length
    });
    
    const contactJSON = JSON.stringify({
      name: contact.name,
      title: contact.title,
      contactInfo: contact.contactInfo,
      researchSummary: contact.researchSummary
    });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: `You are an expert at crafting personalized insights for cold outreach emails.
Create a single paragraph (3-5 sentences) that demonstrates you've done research on the recipient's business and role.
Be specific, mention something unique about their business or professional background if available.
Avoid generic statements that could apply to any business in their industry.
Focus on creating value and building rapport, not just flattery.
Don't use buzzwords or sales language that feels insincere.` 
        },
        { 
          role: "user", 
          content: `Write a personalized insight paragraph for an outreach email.
          
BUSINESS INFORMATION:
${businessJSON}

RECIPIENT INFORMATION:
${contactJSON}

Create a thoughtful, specific paragraph that shows I've researched their business. 
Mention something unique about them or their business if possible.
Make it sound natural and conversational, not like a generic template.
Maximum 3-5 sentences.` 
        }
      ],
      temperature: 0.7
    });
    
    return response.choices[0]?.message?.content || generateFallbackInsight(business, contact);
  } catch (error) {
    console.error("[ContentGeneration] Error generating personalized insight:", error);
    return generateFallbackInsight(business, contact);
  }
}

/**
 * Generate a fallback insight when API call fails
 */
function generateFallbackInsight(
  business: BusinessData,
  contact: EnrichedTeamMember
): string {
  const services = business.services 
    ? business.services.map(s => s.name).slice(0, 2).join(' and ')
    : 'services';
    
  return `I was particularly impressed with your focus on ${services}. From what I've seen, ${business.name} has established a strong reputation in the industry.`;
}

/**
 * Enhance email content with AI
 */
async function enhanceEmailContent(
  email: GeneratedEmail,
  tone: EmailTemplate['tone']
): Promise<GeneratedEmail> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: `You are an expert email copywriter who specializes in ${tone} business emails that get responses.
Your task is to improve an existing email while maintaining its core structure and intent.
Focus on making the language more engaging, personalized, and likely to receive a response.
Keep the same general length (don't make it significantly longer).
Preserve all contact information and signature structure exactly as provided.` 
        },
        { 
          role: "user", 
          content: `Enhance this email to make it more ${tone}, engaging, and likely to get a response.
Keep the same structure, but improve the language and personalization.

SUBJECT: ${email.subject}

BODY:
${email.body}

Provide the enhanced email with the subject line and body clearly labeled.` 
        }
      ],
      temperature: 0.7
    });
    
    const enhancedContent = response.choices[0]?.message?.content;
    
    if (!enhancedContent) {
      return email;
    }
    
    // Extract subject and body from the response
    const subjectMatch = enhancedContent.match(/SUBJECT:?\s*(.*?)(?:\n|$)/i);
    const bodyMatch = enhancedContent.match(/BODY:?\s*([\s\S]*)/i);
    
    const enhancedEmail: GeneratedEmail = {
      ...email,
      subject: subjectMatch ? subjectMatch[1].trim() : email.subject,
      body: bodyMatch ? bodyMatch[1].trim() : email.body
    };
    
    return enhancedEmail;
  } catch (error) {
    console.error("[ContentGeneration] Error enhancing email content:", error);
    return email;
  }
}

/**
 * Generate an email for a follow-up
 */
export async function generateFollowUpEmail(
  originalEmail: GeneratedEmail,
  businessData: BusinessData,
  daysSinceOriginal: number,
  userInfo: {
    name: string;
    company: string;
    title: string;
    email: string;
    phone: string;
  }
): Promise<GeneratedEmail> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: `You are an expert at writing effective, non-pushy follow-up emails.
Create a follow-up email that references the original outreach but adds new value.
The tone should be professional yet friendly, and should not make the recipient feel pressured.
Keep the email concise - 3-4 short paragraphs maximum.` 
        },
        { 
          role: "user", 
          content: `Write a follow-up email based on this original email that was sent ${daysSinceOriginal} days ago.
          
ORIGINAL EMAIL SUBJECT: ${originalEmail.subject}

ORIGINAL EMAIL BODY:
${originalEmail.body}

BUSINESS INFORMATION:
${JSON.stringify({
  name: businessData.name,
  description: businessData.description,
  services: businessData.services?.map(s => s.name).join(', ')
})}

Create a follow-up that:
1. References the original email
2. Adds a new insight or value point not mentioned in the original email
3. Has a clear, low-pressure call to action
4. Maintains a professional, respectful tone

Keep the same signature format as the original email.
Use the subject line "Re: [Original Subject]" or "Following up: [Original Subject]"

Provide the follow-up email with the subject line and body clearly labeled.` 
        }
      ],
      temperature: 0.7
    });
    
    const followUpContent = response.choices[0]?.message?.content;
    
    if (!followUpContent) {
      // Generate a simple follow-up if API call fails
      return {
        ...originalEmail,
        subject: `Following up: ${originalEmail.subject}`,
        body: `Hi ${originalEmail.variables.recipientFirstName},

I sent an email a few days ago about ${businessData.name} and wanted to follow up briefly.

${originalEmail.body.split('\n\n')[1]}

Let me know if you'd be interested in discussing this further.

Best regards,
${userInfo.name}
${userInfo.title}
${userInfo.company}
${userInfo.phone}`
      };
    }
    
    // Extract subject and body from the response
    const subjectMatch = followUpContent.match(/SUBJECT:?\s*(.*?)(?:\n|$)/i);
    const bodyMatch = followUpContent.match(/BODY:?\s*([\s\S]*)/i);
    
    return {
      ...originalEmail,
      subject: subjectMatch ? subjectMatch[1].trim() : `Following up: ${originalEmail.subject}`,
      body: bodyMatch ? bodyMatch[1].trim() : originalEmail.body
    };
  } catch (error) {
    console.error("[ContentGeneration] Error generating follow-up email:", error);
    return {
      ...originalEmail,
      subject: `Following up: ${originalEmail.subject}`,
      body: `Hi ${originalEmail.variables.recipientFirstName},

I hope you're doing well. I wanted to follow up on my previous email about ${businessData.name}.

I'm still interested in connecting to discuss how we might be able to collaborate. Please let me know if you'd be open to a brief conversation.

Best regards,
${userInfo.name}
${userInfo.title}
${userInfo.company}
${userInfo.phone}`
    };
  }
} 