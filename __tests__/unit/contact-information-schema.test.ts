import '../setup-jest-types';
import { contactInformationTable, contactTypeEnum, contactSourceEnum } from '../../db/schema/contact-information-schema';

describe('Contact Information Schema', () => {
  it('should have schema table defined', () => {
    expect(contactInformationTable).toBeTruthy();
  });
  
  it('should have proper enums defined', () => {
    // Test contact type enum
    expect(contactTypeEnum).toBeTruthy();
    expect(contactTypeEnum.enumName).toBe('contact_type');
    expect(contactTypeEnum.enumValues).toContain('email');
    expect(contactTypeEnum.enumValues).toContain('phone');
    expect(contactTypeEnum.enumValues).toContain('linkedin');
    expect(contactTypeEnum.enumValues).toContain('twitter');
    expect(contactTypeEnum.enumValues).toContain('facebook');
    expect(contactTypeEnum.enumValues).toContain('other');
    
    // Test contact source enum
    expect(contactSourceEnum).toBeTruthy();
    expect(contactSourceEnum.enumName).toBe('contact_source');
    expect(contactSourceEnum.enumValues).toContain('manual');
    expect(contactSourceEnum.enumValues).toContain('website');
    expect(contactSourceEnum.enumValues).toContain('linkedin');
    expect(contactSourceEnum.enumValues).toContain('twitter');
    expect(contactSourceEnum.enumValues).toContain('facebook');
    expect(contactSourceEnum.enumValues).toContain('research');
    expect(contactSourceEnum.enumValues).toContain('other');
  });
}); 