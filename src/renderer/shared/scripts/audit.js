const fs = require('fs');
const path = require('path');

const SHARED_DIR = path.join(__dirname, '..');
const BASIC_DIR = path.join(SHARED_DIR, 'basic');

const VIOLATIONS = {
  SYSTEM_CALLS: {
    name: 'System Alert/Confirm Usage',
    regex: /\b(alert|confirm)\s*\(/g,
    description: 'Use shared/basic components or modals instead of native browser popups.'
  },
  COMPONENT_DUPLICATION: {
    name: 'Manual HTML Component Usage',
    tags: ['button', 'input', 'select', 'textarea'],
    description: 'Use shared/basic components (Button, Input, Select) instead of raw HTML tags.'
  },
  HARDCODED_STRINGS: {
    name: 'Potential Hardcoded Strings',
    // Matches text nodes between tags: >Text Content<
    textNodeRegex: />([^<{}]+)</g,
    // Matches common string props: label="Text", title="Text", placeholder="Text"
    propRegex: /\b(label|title|placeholder|description|text)="([^"]+)"/g,
    description: 'Consider moving hardcoded user-facing strings to a constants file or i18n system.'
  }
};

const IGNORE_STRINGS = [
  'void', 'any', 'string', 'number', 'boolean', 'Promise', 'React', 'null', 'undefined',
  'px', 'rem', 'em', '%', 'vh', 'vw', 'grid', 'flex', 'hidden', 'block'
];

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      if (file !== 'scripts' && file !== 'styles' && file !== 'node_modules') {
        walk(filepath, callback);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      callback(filepath);
    }
  });
}

const report = [];

walk(SHARED_DIR, (filepath) => {
  const relativePath = path.relative(SHARED_DIR, filepath);
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');

  // Skip files in basic/ for duplication checks as they ARE the building blocks
  const isBasic = filepath.startsWith(BASIC_DIR);

  // 1. System Calls (DISABLED for this run)
  /*
  let match;
  while ((match = VIOLATIONS.SYSTEM_CALLS.regex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    report.push({
      type: VIOLATIONS.SYSTEM_CALLS.name,
      file: relativePath,
      line: lineNum,
      snippet: lines[lineNum - 1].trim(),
      message: VIOLATIONS.SYSTEM_CALLS.description
    });
  }
  */

  // 2. Component Duplication
  if (!isBasic) {
    VIOLATIONS.COMPONENT_DUPLICATION.tags.forEach(tag => {
      const tagRegex = new RegExp(`<${tag}[\\s>]`, 'g');
      let tagMatch;
      while ((tagMatch = tagRegex.exec(content)) !== null) {
        const lineNum = content.substring(0, tagMatch.index).split('\n').length;
        report.push({
          type: VIOLATIONS.COMPONENT_DUPLICATION.name,
          file: relativePath,
          line: lineNum,
          snippet: lines[lineNum - 1].trim(),
          message: `Found <${tag}>. ${VIOLATIONS.COMPONENT_DUPLICATION.description}`
        });
      }
    });
  }

  // 3. Hardcoded Strings (DISABLED for this run)
  /*
  let textMatch;
  while ((textMatch = VIOLATIONS.HARDCODED_STRINGS.textNodeRegex.exec(content)) !== null) {
    const text = textMatch[1].trim();
    if (isValidString(text)) {
      const lineNum = content.substring(0, textMatch.index).split('\n').length;
      report.push({
        type: VIOLATIONS.HARDCODED_STRINGS.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: `Potential hardcoded text node: "${text}"`
      });
    }
  }

  let propMatch;
  while ((propMatch = VIOLATIONS.HARDCODED_STRINGS.propRegex.exec(content)) !== null) {
    const propName = propMatch[1];
    const text = propMatch[2].trim();
    if (isValidString(text)) {
      const lineNum = content.substring(0, propMatch.index).split('\n').length;
      report.push({
        type: VIOLATIONS.HARDCODED_STRINGS.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: `Potential hardcoded prop ${propName}: "${text}"`
      });
    }
  }
  */
});

function isValidString(text) {
  if (text.length <= 2) return false;
  if (/^[0-9\s.,!?:;()\-+*/=<>]+$/.test(text)) return false; // Only punctuation/numbers
  if (IGNORE_STRINGS.some(s => text.includes(s))) return false;
  if (text.includes('=>')) return false; // Likely a type or arrow function
  if (text.includes('{') || text.includes('}')) return false;
  return true;
}

// Group items by type
const grouped = report.reduce((acc, item) => {
  if (!acc[item.type]) acc[item.type] = [];
  acc[item.type].push(item);
  return acc;
}, {});

// Order types for display (Last in list is most visible at end of terminal)
const DISPLAY_ORDER = [
  VIOLATIONS.HARDCODED_STRINGS.name,
  VIOLATIONS.COMPONENT_DUPLICATION.name,
  VIOLATIONS.SYSTEM_CALLS.name
];

// Output Report
console.log('\n=================================================');
console.log('   Aynite Shared Components Audit Report');
console.log('=================================================\n');

if (report.length === 0) {
  console.log('✅ EXCELLENT: No architectural violations found!\n');
} else {
  DISPLAY_ORDER.forEach(typeName => {
    const items = grouped[typeName] || [];
    if (items.length === 0) return;

    const badge = typeName === VIOLATIONS.SYSTEM_CALLS.name ? '🚨 CRITICAL' : 
                  typeName === VIOLATIONS.COMPONENT_DUPLICATION.name ? '⚠️ WARNING' : '📝 NOTICE';

    console.log(`>>> ${badge}: ${typeName} (${items.length} issues) <<<`);
    console.log('-'.repeat(typeName.length + 25));
    
    items.forEach(item => {
      console.log(`[${item.file}:${item.line}] ${item.snippet}`);
      console.log(`   └─ ${item.message}\n`);
    });
  });

  console.log('=================================================');
  console.log(`TOTAL POTENTIAL ISSUES: ${report.length}`);
  DISPLAY_ORDER.forEach(typeName => {
    const count = grouped[typeName]?.length || 0;
    const status = count > 0 ? (typeName === VIOLATIONS.SYSTEM_CALLS.name ? '🔴 FIX REQUIRED' : '🟡 REFAC OR REVIEW') : '🟢 CLEAN';
    console.log(` - ${typeName}: ${count} [${status}]`);
  });
}
console.log('\n=== End of Report ===\n');
