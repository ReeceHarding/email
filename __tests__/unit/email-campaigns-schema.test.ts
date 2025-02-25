import '../setup-jest-types';
import { emailCampaignsTable, campaignStatusEnum, campaignTypeEnum } from '../../db/schema/email-campaigns-schema';

describe('Email Campaigns Schema', () => {
  it('should have schema table defined', () => {
    expect(emailCampaignsTable).toBeTruthy();
  });
  
  it('should have proper enums defined', () => {
    // Test campaign status enum
    expect(campaignStatusEnum).toBeTruthy();
    expect(campaignStatusEnum.enumName).toBe('campaign_status');
    expect(campaignStatusEnum.enumValues).toContain('draft');
    expect(campaignStatusEnum.enumValues).toContain('active');
    expect(campaignStatusEnum.enumValues).toContain('paused');
    expect(campaignStatusEnum.enumValues).toContain('completed');
    expect(campaignStatusEnum.enumValues).toContain('archived');
    
    // Test campaign type enum
    expect(campaignTypeEnum).toBeTruthy();
    expect(campaignTypeEnum.enumName).toBe('campaign_type');
    expect(campaignTypeEnum.enumValues).toContain('cold_outreach');
    expect(campaignTypeEnum.enumValues).toContain('follow_up');
    expect(campaignTypeEnum.enumValues).toContain('newsletter');
    expect(campaignTypeEnum.enumValues).toContain('announcement');
    expect(campaignTypeEnum.enumValues).toContain('re_engagement');
    expect(campaignTypeEnum.enumValues).toContain('custom');
  });
}); 