import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Handling __dirname for ES modules/tsx
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const SHARED_DIR = path.join(ROOT_DIR, 'src/renderer/shared');
const VIEWS_DIR = path.join(ROOT_DIR, 'src/renderer/views');

interface AuditIssue {
  type: string;
  file: string;
  line: number;
  snippet: string;
  message: string;
}

const VIOLATIONS = {
  IMPORT_HIERARCHY: {
    key: 'import',
    name: 'Import Hierarchy Violation',
    description: 'Enforce strict import layering (lib -> basic -> featured -> pages -> views).'
  },
  STRICT_TYPING: {
    key: 'types',
    name: 'Strict Typing Violation',
    anyRegex: /\b(?!as\b)\bany\b/g,
    untypedParamRegex: /(?:async\s+)?(?:\(([^:)]+)\)|(\b[a-zA-Z0-9_]+\b))\s*=>/g,
    description: 'Avoid use of "any" and ensure all function parameters are explicitly typed.'
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
    description: 'Use shared/basic components (Button, Input, Select, SelectionList) instead of raw HTML tags or manual menus.'
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
  },
  DIRECT_PATH_IMPORT: {
    key: 'path-import',
    name: 'Direct Path Module Import',
    regex: /import\s+.*\s+from\s+['"]path['"]/g,
    description: 'Avoid direct "path" module imports. Use standardized path helpers from src/lib/path.ts instead.'
  },
  FORBIDDEN_PATH_FUNCTIONS: {
    key: 'path-func',
    name: 'Forbidden Path Functions',
    regex: /(?<!\.)\b(?:join|dirname|resolve|extname|basename)\b(?!\s*:)(?=\s*\()|(?<!\.)\bsep\b(?!\s*:)/g,
    description: 'Do not use raw path functions (join, dirname, etc.). Use project-specific path getters or their abstracted wrappers (joinPaths, getDirname, etc.) from lib/path.ts.'
  }
};

// Help display
if (process.argv.includes('-h') || process.argv.includes('--help')) {
  console.log('\nAynite UI Architecture Auditor');
  console.log('Usage: npm run audit:ui -- [options]\n');
  console.log('Options:');
  console.log('  --focus=[type]    Only run specific checks (import, types, strings, tags, styles, system)');
  console.log('  --folder=[path]   Audit a specific folder or file');
  console.log('  -h, --help        Show this help message\n');
  console.log('Examples:');
  console.log('  npm run audit:ui -- --focus=import');
  console.log('  npm run audit:ui -- --folder=src/renderer/shared/basic\n');
  process.exit(0);
}

const focusArg = process.argv.find(arg => arg.startsWith('--focus='))?.split('=')[1];
const folderArg = process.argv.find(arg => arg.startsWith('--folder='))?.split('=')[1];

const activeViolations = focusArg 
  ? Object.values(VIOLATIONS).filter(v => (v as any).key === focusArg || (v as any).name.toLowerCase().includes(focusArg))
  : Object.values(VIOLATIONS);

const targetFolders = folderArg 
  ? [path.resolve(ROOT_DIR, folderArg)] 
  : [SHARED_DIR, VIEWS_DIR];

const IGNORE_STRINGS = [
  'void', 'any', 'string', 'number', 'boolean', 'Promise', 'React', 'null', 'undefined',
  'px', 'rem', 'em', '%', 'vh', 'vw', 'grid', 'flex', 'hidden', 'block'
];

function walk(dir: string, callback: (f: string) => void) {
  if (!fs.existsSync(dir)) return;

  const stats = fs.statSync(dir);
  if (!stats.isDirectory()) {
    if (dir.endsWith('.tsx') || dir.endsWith('.ts')) callback(dir);
    return;
  }

  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filepath = path.join(dir, file);
    const fStats = fs.statSync(filepath);
    if (fStats.isDirectory()) {
      if (file !== 'scripts' && file !== 'styles' && file !== 'node_modules') {
        walk(filepath, callback);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      callback(filepath);
    }
  });
}

function isValidString(text: string) {
  if (text.length <= 2) return false;
  if (/^[0-9\s.,!?:;()\-+*/=<>]+$/.test(text)) return false;
  if (IGNORE_STRINGS.some(s => text.includes(s))) return false;
  if (text.includes('=>')) return false;
  if (text.includes('{') || text.includes('}')) return false;
  return true;
}

const report: AuditIssue[] = [];

const auditFile = (filepath: string) => {
  const relativePath = path.relative(ROOT_DIR, filepath);
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
  if (activeViolations.some(v => (v as any).key === 'import')) {
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

  // 2. Strict Typing
  if (activeViolations.some(v => (v as any).key === 'types')) {
    // Audit for 'any'
    let anyMatch;
    while ((anyMatch = VIOLATIONS.STRICT_TYPING.anyRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, anyMatch.index).split('\n').length;
      report.push({
        type: VIOLATIONS.STRICT_TYPING.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: 'Detected usage of "any". Use more specific types.'
      });
    }

    // Audit for untyped parameters in arrow functions
    let paramMatch;
    while ((paramMatch = VIOLATIONS.STRICT_TYPING.untypedParamRegex.exec(content)) !== null) {
      const group1 = paramMatch[1]; // (arg, arg2)
      const group2 = paramMatch[2]; // arg
      
      const params = (group1 || group2).split(',').map(p => p.trim());
      const hasUntyped = params.some(p => p && !p.includes(':'));

      if (hasUntyped) {
        const lineNum = content.substring(0, paramMatch.index).split('\n').length;
        report.push({
          type: VIOLATIONS.STRICT_TYPING.name,
          file: relativePath,
          line: lineNum,
          snippet: lines[lineNum - 1].trim(),
          message: 'Detected untyped parameters in arrow function.'
        });
      }
    }
  }

  // 3. System Calls
  if (activeViolations.some(v => (v as any).key === 'system')) {
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

  // 4. Component Duplication
  if (activeViolations.some(v => (v as any).key === 'tags') && category !== 'basic' && category !== 'lib') {
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

    // Merge: Detect manual dropdown/menu overlays
    const isOverlay = /\b(absolute|fixed)\b/.test(content) && /\b(bg-sidebar|bg-background|shadow-2xl)\b/.test(content);
    const buttonCount = (content.match(/<button/g) || []).length;
    
    if (isOverlay && buttonCount > 2) {
      const overlayMatch = content.match(/<(?:div|section)[^>]*\b(absolute|fixed)\b[^>]*>/);
      if (overlayMatch) {
        const lineNum = content.substring(0, overlayMatch.index).split('\n').length;
        report.push({
          type: VIOLATIONS.COMPONENT_DUPLICATION.name,
          file: relativePath,
          line: lineNum,
          snippet: lines[lineNum - 1].trim(),
          message: `Detected manual overlay with ${buttonCount} buttons. ${VIOLATIONS.COMPONENT_DUPLICATION.description}`
        });
      }
    }
  }

  // 5. Adaptive Styles
  if (activeViolations.some(v => (v as any).key === 'styles')) {
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
  
  // 6. Hardcoded Strings
  if (activeViolations.some(v => (v as any).key === 'strings')) {
    let textMatch;
    while ((textMatch = (VIOLATIONS.HARDCODED_STRINGS as any).textNodeRegex.exec(content)) !== null) {
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
    while ((propMatch = (VIOLATIONS.HARDCODED_STRINGS as any).propRegex.exec(content)) !== null) {
      const propName = propMatch[1];
      const text = propMatch[2].trim();
      if (isValidString(text)) {
        const lineNum = content.substring(0, propMatch.index).split('\n').length;
        report.push({
          type: (VIOLATIONS.HARDCODED_STRINGS as any).name,
          file: relativePath,
          line: lineNum,
          snippet: lines[lineNum - 1].trim(),
          message: `Potential hardcoded prop ${propName}: "${text}"`
        });
      }
    }
  }

  // 7. Direct Path Module Import
  if (activeViolations.some(v => (v as any).key === 'path-import') && !filepath.endsWith('src/lib/path.ts')) {
    let pathMatch;
    while ((pathMatch = VIOLATIONS.DIRECT_PATH_IMPORT.regex.exec(content)) !== null) {
      const lineNum = content.substring(0, pathMatch.index).split('\n').length;
      report.push({
        type: VIOLATIONS.DIRECT_PATH_IMPORT.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.DIRECT_PATH_IMPORT.description
      });
    }
  }

  // 8. Forbidden Path Functions
  if (activeViolations.some(v => (v as any).key === 'path-func') && !filepath.endsWith('src/lib/path.ts')) {
    let pathMatch;
    while ((pathMatch = VIOLATIONS.FORBIDDEN_PATH_FUNCTIONS.regex.exec(content)) !== null) {
      const lineNum = content.substring(0, pathMatch.index).split('\n').length;
      report.push({
        type: VIOLATIONS.FORBIDDEN_PATH_FUNCTIONS.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.FORBIDDEN_PATH_FUNCTIONS.description
      });
    }
  }
};

targetFolders.forEach(folder => walk(folder, auditFile));

const grouped: Record<string, AuditIssue[]> = report.reduce((acc: Record<string, AuditIssue[]>, item) => {
  if (!acc[item.type]) acc[item.type] = [];
  acc[item.type].push(item);
  return acc;
}, {});

const DISPLAY_ORDER = [
  VIOLATIONS.IMPORT_HIERARCHY.name,
  VIOLATIONS.STRICT_TYPING.name,
  VIOLATIONS.HARDCODED_STRINGS.name,
  VIOLATIONS.COMPONENT_DUPLICATION.name,
  VIOLATIONS.ADAPTIVE_STYLES.name,
  VIOLATIONS.SYSTEM_CALLS.name,
  VIOLATIONS.DIRECT_PATH_IMPORT.name,
  VIOLATIONS.FORBIDDEN_PATH_FUNCTIONS.name
];

console.log('\n=================================================');
console.log('   Aynite Shared & Views Architecture Audit');
if (focusArg) {
  console.log(`   FOCUS: ${activeViolations.map(v => (v as any).name).join(', ')}`);
}
if (folderArg) {
  console.log(`   FOLDER: ${folderArg}`);
}
console.log('=================================================\n');

if (report.length === 0) {
  console.log('✅ EXCELLENT: No architectural violations found!\n');
} else {
  DISPLAY_ORDER.forEach(typeName => {
    const items = grouped[typeName] || [];
    if (items.length === 0) return;

    const badge = typeName === VIOLATIONS.IMPORT_HIERARCHY.name ? '🚨 ARCHITECTURE' : 
                  typeName === VIOLATIONS.STRICT_TYPING.name ? '🚨 TYPING' :
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
    if (focusArg && !activeViolations.some(v => (v as any).name === typeName)) return;

    const count = grouped[typeName]?.length || 0;
    const status = count > 0 ? (typeName === VIOLATIONS.IMPORT_HIERARCHY.name || typeName === VIOLATIONS.STRICT_TYPING.name || typeName === VIOLATIONS.SYSTEM_CALLS.name ? '🔴 FIX REQUIRED' : '🟡 REFAC OR REVIEW') : '🟢 CLEAN';
    console.log(` - ${typeName}: ${count} [${status}]`);
  });
}
console.log('\n=== End of Report ===\n');
