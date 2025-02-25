import '../setup-jest-types';
import { researchDataTable, researchTypeEnum, researchSourceEnum } from '../../db/schema/research-data-schema';

describe('Research Data Schema', () => {
  it('should have schema table defined', () => {
    expect(researchDataTable).toBeTruthy();
  });
  
  it('should have proper enums defined', () => {
    // Test research type enum
    expect(researchTypeEnum).toBeTruthy();
    expect(researchTypeEnum.enumName).toBe('research_type');
    expect(researchTypeEnum.enumValues).toContain('company_info');
    expect(researchTypeEnum.enumValues).toContain('person_info');
    expect(researchTypeEnum.enumValues).toContain('social_media');
    expect(researchTypeEnum.enumValues).toContain('news');
    expect(researchTypeEnum.enumValues).toContain('job_history');
    expect(researchTypeEnum.enumValues).toContain('interests');
    expect(researchTypeEnum.enumValues).toContain('pain_points');
    expect(researchTypeEnum.enumValues).toContain('technology_stack');
    expect(researchTypeEnum.enumValues).toContain('other');
    
    // Test research source enum
    expect(researchSourceEnum).toBeTruthy();
    expect(researchSourceEnum.enumName).toBe('research_source');
    expect(researchSourceEnum.enumValues).toContain('website');
    expect(researchSourceEnum.enumValues).toContain('linkedin');
    expect(researchSourceEnum.enumValues).toContain('twitter');
    expect(researchSourceEnum.enumValues).toContain('news_article');
    expect(researchSourceEnum.enumValues).toContain('job_posting');
    expect(researchSourceEnum.enumValues).toContain('ai_analysis');
    expect(researchSourceEnum.enumValues).toContain('manual');
    expect(researchSourceEnum.enumValues).toContain('other');
  });
}); 