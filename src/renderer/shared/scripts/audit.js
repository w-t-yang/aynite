const fs = require('fs');
const path = require('path');

const SHARED_DIR = path.join(__dirname, '..');
const VIEWS_DIR = path.join(SHARED_DIR, '..', 'views');
const BASIC_DIR = path.join(SHARED_DIR, 'basic');

const VIOLATIONS = {
  IMPORT_HIERARCHY: {
    key: 'import',
    name: 'Import Hierarchy Violation',
    description: 'Enforce strict import layering (lib -> basic -> featured -> pages -> views).'
  },
  HARDCODED_STRINGS: {
    key: 'strings',
    name: 'Potential Hardcoded Strings',
    textNodeRegex: />([^<{}]+)</g,
    propRegex: /\b(label|title|placeholder|description|text)="([^"]+)"/g,
    description: 'Consider moving hardcoded user-facing strings to a constants file or i18n system.'
  },
  COMPONENT_DUPLICATION: {
    key: 'tags',
    name: 'Manual HTML Component Usage',
    tags: ['button', 'input', 'select', 'textarea'],
    description: 'Use shared/basic components (Button, Input, Select) instead of raw HTML tags.'
  },
  ADAPTIVE_STYLES: {
    key: 'styles',
    name: 'Adaptive/Responsive Styles',
    regex: /\b(sm|md|lg|xl|2xl):[a-zA-Z]/g,
    description: 'Avoid using responsive Tailwind prefixes (sm:, md:, etc.) in the shared directory to maintain a stable fixed-width layout.'
  },
  SYSTEM_CALLS: {
    key: 'system',
    name: 'System Alert/Confirm Usage',
    regex: /\b(alert|confirm)\s*\(/g,
    description: 'Use shared/basic components or modals instead of native browser popups.'
  }
};

// Parse command line arguments
const focusArg = process.argv.find(arg => arg.startsWith('--focus='))?.split('=')[1];
const activeViolations = focusArg 
  ? Object.values(VIOLATIONS).filter(v => v.key === focusArg || v.name.toLowerCase().includes(focusArg))
  : Object.values(VIOLATIONS);

const IGNORE_STRINGS = [
  'void', 'any', 'string', 'number', 'boolean', 'Promise', 'React', 'null', 'undefined',
  'px', 'rem', 'em', '%', 'vh', 'vw', 'grid', 'flex', 'hidden', 'block'
];

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
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

function isValidString(text) {
  if (text.length <= 2) return false;
  if (/^[0-9\s.,!?:;()\-+*/=<>]+$/.test(text)) return false;
  if (IGNORE_STRINGS.some(s => text.includes(s))) return false;
  if (text.includes('=>')) return false;
  if (text.includes('{') || text.includes('}')) return false;
  return true;
}

const report = [];

const auditFile = (filepath) => {
  const relativePath = path.relative(path.join(SHARED_DIR, '..'), filepath);
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');

  // Determine category
  let category = '';
  if (filepath.includes(path.join(SHARED_DIR, 'lib'))) category = 'lib';
  else if (filepath.includes(path.join(SHARED_DIR, 'basic'))) category = 'basic';
  else if (filepath.includes(path.join(SHARED_DIR, 'featured', 'advanced'))) category = 'advanced';
  else if (filepath.includes(path.join(SHARED_DIR, 'featured'))) category = 'featured';
  else if (filepath.includes(path.join(SHARED_DIR, 'pages'))) category = 'pages';
  else if (filepath.includes(path.join(SHARED_DIR, 'context'))) category = 'context';
  else if (filepath.includes(VIEWS_DIR)) category = 'views';

  // 1. Import Hierarchy Audit
  if (activeViolations.some(v => v.key === 'import')) {
    const importRegex = /import\s+.*\s+from\s+['"](.*)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const lineNum = content.substring(0, match.index).split('\n').length;

      if (importPath.startsWith('.')) {
        const resolvedPath = path.resolve(path.dirname(filepath), importPath);
        
        let targetCategory = '';
        if (resolvedPath.includes(path.join(SHARED_DIR, 'lib'))) targetCategory = 'lib';
        else if (resolvedPath.includes(path.join(SHARED_DIR, 'basic'))) targetCategory = 'basic';
        else if (resolvedPath.includes(path.join(SHARED_DIR, 'featured', 'advanced'))) targetCategory = 'advanced';
        else if (resolvedPath.includes(path.join(SHARED_DIR, 'featured'))) targetCategory = 'featured';
        else if (resolvedPath.includes(path.join(SHARED_DIR, 'pages'))) targetCategory = 'pages';
        else if (resolvedPath.includes(path.join(SHARED_DIR, 'context'))) targetCategory = 'context';
        else if (resolvedPath.includes(VIEWS_DIR)) targetCategory = 'views';

        let violation = false;
        let msg = '';

        if (category === 'lib') {
          violation = true;
          msg = 'lib module should only import from external packages.';
        } else if (category === 'basic') {
          const isException = filepath.endsWith('basic/Modal.tsx') || filepath.endsWith('basic/Select.tsx');
          if (targetCategory !== 'lib' && targetCategory !== 'context' && !isException) {
            violation = true;
            msg = 'basic components should only import from lib or context.';
          }
        } else if (category === 'featured') {
          if (targetCategory !== 'basic' && targetCategory !== 'lib' && targetCategory !== 'context') {
            violation = true;
            msg = 'featured components should only import from basic, lib, or context.';
          }
        } else if (category === 'advanced') {
          if (targetCategory !== 'featured' && targetCategory !== 'basic' && targetCategory !== 'lib' && targetCategory !== 'context' && targetCategory !== 'advanced') {
            violation = true;
            msg = 'advanced featured components should only import from featured, basic, lib, or context.';
          }
        } else if (category === 'pages') {
          if (targetCategory === 'pages') {
            const currentDir = path.dirname(filepath);
            const targetDir = path.dirname(resolvedPath);
            if (currentDir !== targetDir) {
              violation = true;
              msg = 'Pages should not import from other page directories. Consider refactoring shared logic to featured/basic.';
            }
          } else if (targetCategory === 'views') {
            violation = true;
            msg = 'Shared pages should not import from views.';
          }
        }

        if (violation) {
          report.push({
            type: VIOLATIONS.IMPORT_HIERARCHY.name,
            file: relativePath,
            line: lineNum,
            snippet: lines[lineNum - 1].trim(),
            message: msg
          });
        }
      }
    }
  }

  // 2. System Calls
  if (activeViolations.some(v => v.key === 'system')) {
    let sysMatch;
    while ((sysMatch = VIOLATIONS.SYSTEM_CALLS.regex.exec(content)) !== null) {
      const lineNum = content.substring(0, sysMatch.index).split('\n').length;
      report.push({
        type: VIOLATIONS.SYSTEM_CALLS.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.SYSTEM_CALLS.description
      });
    }
  }

  // 3. Component Duplication
  if (activeViolations.some(v => v.key === 'tags') && category !== 'basic' && category !== 'lib') {
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

  // 4. Adaptive Styles
  if (activeViolations.some(v => v.key === 'styles')) {
    let adaptMatch;
    while ((adaptMatch = VIOLATIONS.ADAPTIVE_STYLES.regex.exec(content)) !== null) {
      const lineNum = content.substring(0, adaptMatch.index).split('\n').length;
      report.push({
        type: VIOLATIONS.ADAPTIVE_STYLES.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.ADAPTIVE_STYLES.description
      });
    }
  }

  // 5. Hardcoded Strings
  if (activeViolations.some(v => v.key === 'strings')) {
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
  }
};

walk(SHARED_DIR, (f) => auditFile(f));
walk(VIEWS_DIR, (f) => auditFile(f));

const grouped = report.reduce((acc, item) => {
  if (!acc[item.type]) acc[item.type] = [];
  acc[item.type].push(item);
  return acc;
}, {});

const DISPLAY_ORDER = [
  VIOLATIONS.IMPORT_HIERARCHY.name,
  VIOLATIONS.HARDCODED_STRINGS.name,
  VIOLATIONS.COMPONENT_DUPLICATION.name,
  VIOLATIONS.ADAPTIVE_STYLES.name,
  VIOLATIONS.SYSTEM_CALLS.name
];

console.log('\n=================================================');
console.log('   Aynite Shared & Views Architecture Audit');
if (focusArg) {
  console.log(`   FOCUS: ${activeViolations.map(v => v.name).join(', ')}`);
}
console.log('=================================================\n');

if (report.length === 0) {
  console.log('✅ EXCELLENT: No architectural violations found!\n');
} else {
  DISPLAY_ORDER.forEach(typeName => {
    const items = grouped[typeName] || [];
    if (items.length === 0) return;

    const badge = typeName === VIOLATIONS.IMPORT_HIERARCHY.name ? '🚨 ARCHITECTURE' : 
                  typeName === VIOLATIONS.SYSTEM_CALLS.name ? '🚨 CRITICAL' : 
                  typeName === VIOLATIONS.ADAPTIVE_STYLES.name ? '⚠️ WARNING' :
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
    // Only show summary for violations that were actually checked
    if (focusArg && !activeViolations.some(v => v.name === typeName)) return;

    const count = grouped[typeName]?.length || 0;
    const status = count > 0 ? (typeName === VIOLATIONS.IMPORT_HIERARCHY.name || typeName === VIOLATIONS.SYSTEM_CALLS.name ? '🔴 FIX REQUIRED' : '🟡 REFAC OR REVIEW') : '🟢 CLEAN';
    console.log(` - ${typeName}: ${count} [${status}]`);
  });
}
console.log('\n=== End of Report ===\n');
if (report.length > 0 && activeViolations.some(v => v.key === 'import' || v.key === 'system')) {
  // Exit with error if critical violations are found
  // (Optional: depends on if the user wants build failure)
  // process.exit(1); 
}
