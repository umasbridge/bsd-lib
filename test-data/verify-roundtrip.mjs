/**
 * Verify round-trip: parse → serialize → parse → compare
 * Also compare page IDs against old parser output for formatting compatibility.
 */
import { readFileSync } from 'fs';
import { parseSystemMd } from '../lib/parseSystemMd.js';
import { toSystemMd } from '../lib/toSystemMd.js';

// Also import old parser for comparison
import { parseSystemMd as parseSystemMdOld } from '../lib/parseSystemMd.old.js';

const files = [
  { name: 'System Notes - MJR', md: 'system-notes-mjr.md', fmt: 'system-notes-mjr.formatting.json' },
  { name: 'Uma + PS Dec 2025', md: 'uma-ps-dec2025.md', fmt: 'uma-ps-dec2025.formatting.json' },
];

let allPassed = true;

for (const file of files) {
  console.log(`\n=== ${file.name} ===`);
  const md = readFileSync(new URL(file.md, import.meta.url), 'utf-8');
  const formatting = JSON.parse(readFileSync(new URL(file.fmt, import.meta.url), 'utf-8'));

  // Parse with new parser
  const system = parseSystemMd(md);
  console.log(`Pages: ${system.pages.length}`);
  console.log(`Top-level: ${system.pages.filter(p => p.topLevel).length}`);
  console.log(`Non-top-level: ${system.pages.filter(p => !p.topLevel).length}`);

  // Parse with old parser for comparison
  const oldSystem = parseSystemMdOld(md);

  // Collect all page IDs from old parser (chapters + subchapters)
  const oldPageIds = new Set();
  for (const ch of oldSystem.chapters) {
    oldPageIds.add(`page-${ch.id}`);
    for (const sub of ch.subchapters || []) {
      oldPageIds.add(`page-${sub.id}`);
    }
  }

  // Collect all page IDs from new parser
  const newPageIds = new Set();
  for (const page of system.pages) {
    newPageIds.add(`page-${page.id}`);
  }

  // Check page ID compatibility
  const missingInNew = [...oldPageIds].filter(id => !newPageIds.has(id));
  const extraInNew = [...newPageIds].filter(id => !oldPageIds.has(id));

  if (missingInNew.length > 0) {
    console.log(`FAIL: Page IDs missing in new parser: ${missingInNew.join(', ')}`);
    allPassed = false;
  }
  if (extraInNew.length > 0) {
    console.log(`WARN: Extra page IDs in new parser: ${extraInNew.join(', ')}`);
  }
  if (missingInNew.length === 0) {
    console.log(`OK: All old page IDs preserved`);
  }

  // Check formatting keys resolve
  const fmtKeys = Object.keys(formatting);
  const unresolvedKeys = fmtKeys.filter(k => k !== 'main' && !newPageIds.has(k));
  if (unresolvedKeys.length > 0) {
    console.log(`FAIL: Formatting keys don't resolve: ${unresolvedKeys.join(', ')}`);
    allPassed = false;
  } else {
    console.log(`OK: All formatting keys resolve to page IDs`);
  }

  // Check element counts match
  let oldElCount = 0;
  for (const ch of oldSystem.chapters) {
    oldElCount += ch.elements.length;
    for (const sub of ch.subchapters || []) {
      oldElCount += sub.elements.length;
    }
  }
  let newElCount = 0;
  for (const page of system.pages) {
    newElCount += page.elements.length;
  }
  if (oldElCount !== newElCount) {
    console.log(`FAIL: Element count mismatch: old=${oldElCount}, new=${newElCount}`);
    allPassed = false;
  } else {
    console.log(`OK: Element count matches (${newElCount})`);
  }

  // Round-trip: serialize → parse → compare
  const serialized = toSystemMd(system);
  const reparsed = parseSystemMd(serialized);

  if (reparsed.pages.length !== system.pages.length) {
    console.log(`FAIL: Round-trip page count: ${system.pages.length} → ${reparsed.pages.length}`);
    allPassed = false;
  } else {
    console.log(`OK: Round-trip page count preserved (${reparsed.pages.length})`);
  }

  // Compare page names
  for (let i = 0; i < system.pages.length; i++) {
    if (system.pages[i].name !== reparsed.pages[i].name) {
      console.log(`FAIL: Page ${i} name changed: "${system.pages[i].name}" → "${reparsed.pages[i].name}"`);
      allPassed = false;
    }
  }

  // Compare element counts per page
  for (let i = 0; i < system.pages.length; i++) {
    const origEls = system.pages[i].elements.length;
    const reparsedEls = reparsed.pages[i].elements.length;
    if (origEls !== reparsedEls) {
      console.log(`FAIL: Page "${system.pages[i].name}" element count: ${origEls} → ${reparsedEls}`);
      allPassed = false;
    }
  }

  // Note: after round-trip, all pages become topLevel: true (since we serialize all as #)
  // This is expected behavior — old ### pages become # on first save
  const oldSubchapterCount = system.pages.filter(p => !p.topLevel).length;
  const reparsedNonTopLevel = reparsed.pages.filter(p => !p.topLevel).length;
  if (oldSubchapterCount > 0 && reparsedNonTopLevel === 0) {
    console.log(`OK: Expected migration: ${oldSubchapterCount} non-top-level pages → all top-level after serialize`);
  }
}

console.log(`\n${'='.repeat(40)}`);
console.log(allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
