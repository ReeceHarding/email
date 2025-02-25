import '../setup-jest-types';
import { emailMessagesTable, messageStatusEnum, messageTypeEnum } from '../../db/schema/email-messages-schema';

describe('Email Messages Schema', () => {
  it('should have schema table defined', () => {
    expect(emailMessagesTable).toBeTruthy();
  });
  
  it('should have proper enums defined', () => {
    // Test message status enum
    expect(messageStatusEnum).toBeTruthy();
    expect(messageStatusEnum.enumName).toBe('message_status');
    expect(messageStatusEnum.enumValues).toContain('draft');
    expect(messageStatusEnum.enumValues).toContain('scheduled');
    expect(messageStatusEnum.enumValues).toContain('sending');
    expect(messageStatusEnum.enumValues).toContain('sent');
    expect(messageStatusEnum.enumValues).toContain('delivered');
    expect(messageStatusEnum.enumValues).toContain('opened');
    expect(messageStatusEnum.enumValues).toContain('clicked');
    expect(messageStatusEnum.enumValues).toContain('replied');
    expect(messageStatusEnum.enumValues).toContain('bounced');
    expect(messageStatusEnum.enumValues).toContain('failed');
    
    // Test message type enum
    expect(messageTypeEnum).toBeTruthy();
    expect(messageTypeEnum.enumName).toBe('message_type');
    expect(messageTypeEnum.enumValues).toContain('initial');
    expect(messageTypeEnum.enumValues).toContain('follow_up');
    expect(messageTypeEnum.enumValues).toContain('custom');
  });
}); 