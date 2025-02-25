import fs from 'fs';
import path from 'path';
import '../setup-jest-types';

// Helper function to check if a file exists
function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

describe('Database Schema Setup', () => {
  const schemaDir = path.join(process.cwd(), 'db', 'schema');
  
  it('should have schema directory', () => {
    expect(fileExists(schemaDir)).toBeTruthy();
  });

  it('should have all required schema files', () => {
    const requiredSchemas = [
      'users-schema.ts',
      'business-profiles-schema.ts',
      'team-members-schema.ts',
      'contact-information-schema.ts',
      'research-data-schema.ts',
      'email-campaigns-schema.ts',
      'email-messages-schema.ts',
    ];

    requiredSchemas.forEach(schemaFile => {
      const filePath = path.join(schemaDir, schemaFile);
      expect(fileExists(filePath)).toBeTruthy();
    });
  });

  it('should have schema index file with all exports', () => {
    const indexPath = path.join(schemaDir, 'index.ts');
    expect(fileExists(indexPath)).toBeTruthy();
    
    // Read the index file contents
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Check that each schema is exported
    [
      'users', 
      'businessProfiles', 
      'teamMembers', 
      'contactInformation', 
      'researchData', 
      'emailCampaigns', 
      'emailMessages'
    ].forEach(schemaName => {
      const exportLine = `export * from "./${schemaName.replace(/([A-Z])/g, '-$1').toLowerCase()}-schema"`;
      expect(indexContent.includes(exportLine)).toBeTruthy();
    });
  });

  it('should import all schemas in main db file', () => {
    const dbFilePath = path.join(process.cwd(), 'db', 'db.ts');
    expect(fileExists(dbFilePath)).toBeTruthy();
    
    const dbFileContent = fs.readFileSync(dbFilePath, 'utf8');
    
    // Check imports
    [
      'usersTable', 
      'businessProfilesTable', 
      'teamMembersTable', 
      'contactInformationTable', 
      'researchDataTable', 
      'emailCampaignsTable', 
      'emailMessagesTable'
    ].forEach(tableName => {
      expect(dbFileContent.includes(`import { ${tableName} }`)).toBeTruthy();
    });
    
    // Check schema object includes all tables
    [
      'users', 
      'businessProfiles', 
      'teamMembers', 
      'contactInformation', 
      'researchData', 
      'emailCampaigns', 
      'emailMessages'
    ].forEach(schemaName => {
      expect(dbFileContent.includes(`${schemaName}: ${schemaName}Table`)).toBeTruthy();
    });
  });
}); 