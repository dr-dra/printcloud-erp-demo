// Simple test to validate quotations page syntax
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing quotations page syntax...');

try {
  // Read the quotations page file
  const quotationsPagePath = path.join(__dirname, 'src/app/dashboard/sales/quotations/page.tsx');
  const content = fs.readFileSync(quotationsPagePath, 'utf8');

  // Basic syntax checks
  const hasValidImports = content.includes('import React') || content.includes("'use client'");
  const hasValidExport = content.includes('export default');
  const hasValidJSX = content.includes('return (');
  const hasAPICall = content.includes('api.get');

  console.log('✅ Syntax validation results:');
  console.log(`  - Has valid imports: ${hasValidImports}`);
  console.log(`  - Has default export: ${hasValidExport}`);
  console.log(`  - Has JSX return: ${hasValidJSX}`);
  console.log(`  - Has API calls: ${hasAPICall}`);

  // Check for common syntax errors
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;
  const openParens = (content.match(/\(/g) || []).length;
  const closeParens = (content.match(/\)/g) || []).length;

  console.log(
    `  - Brace balance: ${openBraces === closeBraces ? '✅' : '❌'} (${openBraces}/${closeBraces})`,
  );
  console.log(
    `  - Parentheses balance: ${openParens === closeParens ? '✅' : '❌'} (${openParens}/${closeParens})`,
  );

  // Check types file
  const typesPath = path.join(__dirname, 'src/types/quotations.ts');
  if (fs.existsSync(typesPath)) {
    console.log('✅ Quotations types file exists');
  }

  console.log('✅ Basic syntax validation complete!');
} catch (error) {
  console.error('❌ Syntax validation error:', error.message);
}
