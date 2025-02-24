import { extractTeamMembers, TeamMember } from "./firecrawl";

const sampleTeamText = `
Meet Our Team:
1) Dr. John Smith - CEO & Founder
2) Dr. Alice Brown - Head of Research
3) Bob Stone-Jones - Head of Operations
4) Jane Doe - Senior Manager, Product Development
5) Mike Johnson - Lead Developer
We are an advanced practice with awesome staff.
Email: test@example.com

About Our Leadership:
Sarah Wilson - President & Board Member
Tom Clark - Director of Sales
Mrs. Emma Davis - VP of Marketing
Mr. James Wilson Jr. - Chief Technology Officer
Contact: james@company.com
LinkedIn: linkedin.com/in/jameswilson

The Team:
Prof. Robert Lee - Senior Researcher
Rev. Michael White - Board Advisor
`;

async function runTest() {
  console.log("[TestTeamMemberParsing] Running test on sample text...");
  const found: TeamMember[] = extractTeamMembers(sampleTeamText);
  console.log("[TestTeamMemberParsing] Found members:", JSON.stringify(found, null, 2));
  
  // Test 1: Basic count
  const expectedCount = 11; // The actual number of unique team members
  if (found.length === expectedCount) {
    console.log(`[TestTeamMemberParsing] ✓ Found exactly ${expectedCount} team members`);
  } else {
    console.error(`[TestTeamMemberParsing] ✗ Expected ${expectedCount} members, got ${found.length}`);
    process.exit(1);
  }

  // Test 2: No false positives
  const falsePositives = found.filter(m => 
    m.name.includes("Meet Our") || 
    m.name.includes("About Our") ||
    m.name.includes("The Team") ||
    m.name.includes("Senior Manager") ||
    m.name.includes("Lead Developer") ||
    m.name.includes("Senior Researcher")
  );
  if (falsePositives.length === 0) {
    console.log("[TestTeamMemberParsing] ✓ No false positives found");
  } else {
    console.error("[TestTeamMemberParsing] ✗ Found false positives:", falsePositives);
    process.exit(1);
  }

  // Test 3: Title extraction
  const tests = [
    {
      check: () => found.some(m => m.name.includes("Dr.") && m.title?.includes("CEO")),
      message: "Found Dr. John Smith as CEO"
    },
    {
      check: () => found.some(m => m.name.includes("Stone-Jones")),
      message: "Found hyphenated last name"
    },
    {
      check: () => found.some(m => m.name.includes("James") && m.email === "james@company.com"),
      message: "Found member with email"
    },
    {
      check: () => found.some(m => m.name.includes("James") && m.linkedin?.includes("linkedin.com/in/jameswilson")),
      message: "Found member with LinkedIn"
    },
    {
      check: () => found.some(m => m.title?.includes("Vice President")),
      message: "Found VP with expanded title"
    },
    {
      check: () => found.some(m => m.name.includes("Jr.")),
      message: "Preserved Jr. suffix in name"
    },
    {
      check: () => found.some(m => m.title?.includes("CEO (Chief Executive Officer)")),
      message: "Found CEO with both short and long forms"
    }
  ];

  for (const test of tests) {
    if (test.check()) {
      console.log(`[TestTeamMemberParsing] ✓ ${test.message}`);
    } else {
      console.error(`[TestTeamMemberParsing] ✗ ${test.message}`);
      process.exit(1);
    }
  }

  console.log("[TestTeamMemberParsing] All tests passed! ✨");
}

// If run directly from CLI, perform test
if (require.main === module) {
  runTest().catch(err => {
    console.error("[TestTeamMemberParsing] Test script error:", err);
    process.exit(1);
  });
}

export { runTest }; 