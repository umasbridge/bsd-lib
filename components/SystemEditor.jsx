import { useState, useCallback, useRef, useMemo } from 'react';
import { Page } from './page';
import { PopupView } from './page';
import { EditorProvider } from './EditorContext';
import { parseSystemMd } from '../lib/parseSystemMd';
import { toSystemMd } from '../lib/toSystemMd';
import { replaceSuitAbbreviations, colorizeSuitSymbols, stripSuitColorSpans } from '../lib/suitSymbols';

// ─── ID generation ───

let _rowIdCounter = 0;
function uid() {
  return `r-${++_rowIdCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Text helpers ───

function boldToHtml(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<span style="font-weight: 700">$1</span>');
}

function markdownLinksToHtml(text) {
  // Convert [text](url) to <a> tags (external URLs only, not [Name|mode] cross-refs)
  return text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    (_, linkText, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; cursor: pointer;">${linkText}</a>`
  );
}

function stripBold(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '$1');
}

function markdownListsToHtml(text) {
  const lines = text.split('\n');

  function parseLine(line) {
    const rawIndent = line.match(/^(\s*)/)[1].length;
    const trimmed = line.trim();
    if (!trimmed) return null;

    const olMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (olMatch) return { indent: Math.floor(rawIndent / 2), type: 'ol', content: olMatch[1] };

    const ulMatch = trimmed.match(/^[-*•➢►▪▸]\s*(.+)/);
    if (ulMatch) return { indent: Math.floor(rawIndent / 2), type: 'ul', content: ulMatch[1] };

    return { indent: 0, type: 'text', content: trimmed };
  }

  const parsed = lines.map(parseLine).filter(Boolean);
  if (parsed.length === 0) return text;
  if (!parsed.some(p => p.type !== 'text')) return text;

  // Recursively build nested list HTML
  function buildList(idx, baseIndent) {
    if (idx >= parsed.length || parsed[idx].type === 'text') return ['', idx];

    const listType = parsed[idx].type;
    let html = `<${listType}>`;

    while (idx < parsed.length && parsed[idx].type === listType && parsed[idx].indent === baseIndent) {
      html += `<li>${parsed[idx].content}`;
      idx++;
      // Gather all children at deeper indent (may include multiple nested list types)
      while (idx < parsed.length && parsed[idx].indent > baseIndent && parsed[idx].type !== 'text') {
        const [childHtml, nextIdx] = buildList(idx, parsed[idx].indent);
        html += childHtml;
        idx = nextIdx;
      }
      html += '</li>';
    }

    html += `</${listType}>`;
    return [html, idx];
  }

  let result = '';
  let i = 0;
  while (i < parsed.length) {
    if (parsed[i].type === 'text') {
      if (result) result += '<br/>';
      result += parsed[i].content;
      i++;
    } else {
      const [listHtml, nextIdx] = buildList(i, parsed[i].indent);
      result += listHtml;
      i = nextIdx;
    }
  }

  return result;
}

function splitLink(text, pageId) {
  return `<a href="bridge://${pageId}/split" data-page-id="${pageId}" data-link-mode="split" style="color: #2563eb; text-decoration: underline; cursor: pointer;">${text}</a>`;
}

function popupLink(text, pageId) {
  return `<a href="bridge://${pageId}/popup" data-page-id="${pageId}" data-link-mode="popup" style="color: #2563eb; text-decoration: underline; cursor: pointer;">${text}</a>`;
}

function newtabLink(text, pageId) {
  return `<a href="bridge://${pageId}/newtab" data-page-id="${pageId}" data-link-mode="newtab" style="color: #2563eb; text-decoration: underline; cursor: pointer;">${text}</a>`;
}

/**
 * Build a lookup from page name (lowercase) → page id.
 */
function buildPageLookup(pages) {
  const map = {};
  for (const page of pages) {
    const pageId = `page-${page.id}`;
    const nameLower = page.name.toLowerCase();
    map[nameLower] = pageId;
    // Also map the suit-symbol-converted name so cross-references like
    // [Over 1m2♥|popup] match headings like "### Over 1m2h"
    const converted = replaceSuitAbbreviations(nameLower);
    if (converted !== nameLower) {
      map[converted] = pageId;
    }
  }
  return map;
}

/**
 * Replace [Chapter Name] or [Chapter Name|popup] with hyperlinks.
 * Default mode is split. Use |popup suffix for popup links.
 */
function injectCrossReferences(text, pageLookup) {
  return text.replace(/\[([^\]]+)\]/g, (match, inner) => {
    const parts = inner.split('|');
    const name = parts[0].trim();
    const mode = parts[1]?.trim().toLowerCase() || 'split';
    // Strip suit color spans for lookup, but keep colorized version for display
    const cleanName = stripSuitColorSpans(name);
    const displayName = colorizeSuitSymbols(replaceSuitAbbreviations(cleanName));
    const pageId = pageLookup[cleanName.toLowerCase()];
    if (pageId) {
      if (mode === 'popup') return popupLink(displayName, pageId);
      if (mode === 'newtab') return newtabLink(displayName, pageId);
      return splitLink(displayName, pageId);
    }
    return cleanName;
  });
}

// ─── Transform: intermediate → PageData[] ───

function mapRow(row, pageLookup) {
  const meaning = row.meaning || '';
  const columns = row.columns && row.columns.length > 1
    ? row.columns.map(c => ({ value: c || '' }))
    : [{ value: meaning }];

  const rawBid = row.bid || '';
  // Resolve cross-references BEFORE suit conversion so page names like
  // "2 Club Opening" don't get corrupted to "2 ♣ Opening"
  const bidRefResolved = injectCrossReferences(rawBid, pageLookup);
  const hasBidLink = bidRefResolved !== rawBid;
  let bidDisplay = colorizeSuitSymbols(replaceSuitAbbreviations(rawBid));
  const mapped = {
    id: uid(),
    bid: bidDisplay,
    columns,
    children: (row.children || []).map((child) => mapRow(child, pageLookup)),
  };
  if (hasBidLink) {
    mapped.bidHtml = bidRefResolved;
  }

  // Colorize suit symbols and inject cross-references in all columns
  for (let i = 0; i < mapped.columns.length; i++) {
    const val = mapped.columns[i].value;
    if (val) {
      let html = colorizeSuitSymbols(replaceSuitAbbreviations(val));
      html = injectCrossReferences(html, pageLookup);
      html = markdownLinksToHtml(html);
      if (html !== val) {
        mapped.columns[i].html = html;
      }
    }
  }

  return mapped;
}


/**
 * Reorder parsed elements to match saved formatting order if they differ.
 * Uses elementNames (saved during extractPageFormatting) to detect misalignment.
 */
function reorderElements(elements, pageFmt) {
  const savedNames = pageFmt.elementNames;
  if (!savedNames || savedNames.length === 0 || elements.length === 0) return elements;
  if (elements.length !== savedNames.length) return elements;

  // Build current name list from parsed elements
  const currentNames = elements.map(el => {
    if (el.type === 'table') return el.name || '';
    if (el.type === 'note') return `__text__${(el.content || '').slice(0, 30)}`;
    return `__${el.type}__`;
  });

  // Check if already aligned
  const aligned = currentNames.every((n, i) => n === savedNames[i]);
  if (aligned) return elements;

  // Try to reorder: for each saved name, find the matching element
  const remaining = [...elements];
  const reordered = [];
  for (const name of savedNames) {
    const idx = remaining.findIndex(el => {
      const elName = el.type === 'table' ? (el.name || '') :
        el.type === 'note' ? `__text__${(el.content || '').slice(0, 30)}` :
        `__${el.type}__`;
      return elName === name;
    });
    if (idx !== -1) {
      reordered.push(remaining.splice(idx, 1)[0]);
    }
  }
  // Append any unmatched elements at the end
  reordered.push(...remaining);
  return reordered;
}

function buildPage(sourcePage, pageLookup, formatting) {
  const pageId = `page-${sourcePage.id}`;
  const pageFmt = formatting?.[pageId] || {};
  const pageElements = [];
  const sourceElements = reorderElements(sourcePage.elements || [], pageFmt);

  for (let i = 0; i < sourceElements.length; i++) {
    const el = sourceElements[i];
    const elFmt = pageFmt.elements?.[i] || {};

    if (el.type === 'note') {
      // Use stored htmlContent (preserves indents etc.) if available, else regenerate
      let htmlContent;
      if (elFmt.htmlContent) {
        // Apply suit conversion to stored HTML (may contain unconverted abbreviations)
        htmlContent = stripSuitColorSpans(elFmt.htmlContent);
        htmlContent = replaceSuitAbbreviations(htmlContent);
        htmlContent = colorizeSuitSymbols(htmlContent);
      } else {
        htmlContent = markdownListsToHtml(boldToHtml(replaceSuitAbbreviations(el.content)));
        htmlContent = colorizeSuitSymbols(htmlContent);
        htmlContent = injectCrossReferences(htmlContent, pageLookup);
        htmlContent = markdownLinksToHtml(htmlContent);
      }

      pageElements.push({
        id: `${sourcePage.id}-el-${i}`,
        type: 'text',
        order: i + 1,
        content: stripBold(el.content),
        htmlContent,
        width: elFmt.width ?? 580,
        borderColor: elFmt.borderColor ?? '#d1d5db',
        borderWidth: elFmt.borderWidth ?? 1,
        fillColor: elFmt.fillColor ?? 'transparent',
        ...(elFmt.margin ? { margin: elFmt.margin } : {}),
      });
    } else if (el.type === 'html') {
      pageElements.push({
        id: `${sourcePage.id}-el-${i}`,
        type: 'html',
        order: i + 1,
        content: el.content,
        width: elFmt.width ?? 1160,
      });
    } else if (el.type === 'table') {
      const rows = (el.rows || []).map((row) => mapRow(row, pageLookup));
      applyRowMerges(rows, elFmt.rowMerges);
      applyRowHtml(rows, elFmt.rowHtml, pageLookup);
      const bidtableEl = {
        id: `${sourcePage.id}-el-${i}`,
        type: 'bidtable',
        order: i + 1,
        name: el.name,
        nameHtml: `<span style="font-weight: 700">${el.name}</span>`,
        showName: true,
        width: elFmt.width ?? 620,
        columnWidths: elFmt.columnWidths ?? [480],
        levelWidths: elFmt.levelWidths ?? { 0: 80 },
        gridlines: elFmt.gridlines ?? { enabled: true, color: '#D1D5DB', width: 1 },
        borderColor: elFmt.borderColor ?? '#d1d5db',
        borderWidth: elFmt.borderWidth ?? 1,
        startExpanded: false,
        rows,
      };
      if (elFmt.tocTable) bidtableEl.tocTable = true;
      pageElements.push(bidtableEl);
    }
  }

  return {
    id: pageId,
    title: replaceSuitAbbreviations(sourcePage.name),
    titleHtml: colorizeSuitSymbols(stripSuitColorSpans(
      pageFmt.titleHtml || `<span style="font-weight: 700">${replaceSuitAbbreviations(sourcePage.name)}</span>`
    )),
    leftMargin: pageFmt.leftMargin ?? 20,
    rightMargin: pageFmt.rightMargin ?? 20,
    elementSpacing: pageFmt.elementSpacing ?? 30,
    elements: pageElements,
  };
}


export function transformToPages(system, formatting) {
  _rowIdCounter = 0;

  const { systemName, description, rootElements = [], pages: sourcePages = [] } = system;
  const pageLookup = buildPageLookup(sourcePages);
  const mainFmt = formatting?.main || {};

  // Build main page elements from root elements (no auto-generated TOC)
  const mainElements = [];

  // Reorder root elements to match saved formatting order if needed
  const orderedRootElements = reorderElements(rootElements, mainFmt);

  // Add root elements (elements before any # heading) to main page
  for (let i = 0; i < orderedRootElements.length; i++) {
    const el = orderedRootElements[i];
    const elIdx = mainElements.length;
    const elFmt = mainFmt.elements?.[elIdx] || {};

    if (el.type === 'note') {
      let htmlContent;
      if (elFmt.htmlContent) {
        // Apply suit conversion to stored HTML (may contain unconverted abbreviations)
        htmlContent = stripSuitColorSpans(elFmt.htmlContent);
        htmlContent = replaceSuitAbbreviations(htmlContent);
        htmlContent = colorizeSuitSymbols(htmlContent);
      } else {
        htmlContent = markdownListsToHtml(boldToHtml(replaceSuitAbbreviations(el.content)));
        htmlContent = colorizeSuitSymbols(htmlContent);
        htmlContent = injectCrossReferences(htmlContent, pageLookup);
        htmlContent = markdownLinksToHtml(htmlContent);
      }
      mainElements.push({
        id: `main-el-${elIdx}`,
        type: 'text',
        order: elIdx + 1,
        content: stripBold(el.content),
        htmlContent,
        width: elFmt.width ?? 580,
        borderColor: elFmt.borderColor ?? '#d1d5db',
        borderWidth: elFmt.borderWidth ?? 1,
        fillColor: elFmt.fillColor ?? 'transparent',
      });
    } else if (el.type === 'html') {
      mainElements.push({
        id: `main-el-${elIdx}`,
        type: 'html',
        order: elIdx + 1,
        content: el.content,
        width: elFmt.width ?? 1160,
      });
    } else if (el.type === 'table') {
      const rows = (el.rows || []).map((row) => mapRow(row, pageLookup));
      applyRowMerges(rows, elFmt.rowMerges);
      applyRowHtml(rows, elFmt.rowHtml, pageLookup);
      const bidtableEl = {
        id: `main-el-${elIdx}`,
        type: 'bidtable',
        order: elIdx + 1,
        name: el.name,
        nameHtml: `<span style="font-weight: 700">${el.name}</span>`,
        showName: !!el.name,
        width: elFmt.width ?? 620,
        columnWidths: elFmt.columnWidths ?? [480],
        levelWidths: elFmt.levelWidths ?? { 0: 80 },
        gridlines: elFmt.gridlines ?? { enabled: true, color: '#D1D5DB', width: 1 },
        borderColor: elFmt.borderColor ?? '#d1d5db',
        borderWidth: elFmt.borderWidth ?? 1,
        startExpanded: false,
        rows,
      };
      if (elFmt.tocTable) bidtableEl.tocTable = true;
      mainElements.push(bidtableEl);
    }
  }

  // If no root elements, auto-generate a TOC table linking to each page
  if (mainElements.length === 0 && sourcePages.length > 0) {
    // Only include top-level pages (from # headings) — find pages that are not
    // subpages of other pages. Since the parser creates pages for both # and ###,
    // we include all sourcePages in the TOC.
    const tocFmt = mainFmt.elements?.[0] || {};
    const tocRows = sourcePages.map((sp, i) => {
      const pageId = `page-${sp.id}`;
      return {
        id: `toc-${i + 1}`,
        bid: replaceSuitAbbreviations(sp.name),
        bidHtml: splitLink(colorizeSuitSymbols(replaceSuitAbbreviations(sp.name)), pageId),
        columns: [{ value: '' }],
        children: [],
      };
    });
    mainElements.push({
      id: 'main-toc',
      type: 'bidtable',
      order: 1,
      name: 'Table of Contents',
      nameHtml: '<span style="font-weight: 700">Table of Contents</span>',
      showName: true,
      tocTable: true,
      width: tocFmt.width ?? 580,
      columnWidths: tocFmt.columnWidths ?? [430],
      levelWidths: tocFmt.levelWidths ?? { 0: 80 },
      gridlines: tocFmt.gridlines ?? { enabled: true, color: '#D1D5DB', width: 1 },
      borderColor: tocFmt.borderColor ?? '#d1d5db',
      borderWidth: tocFmt.borderWidth ?? 1,
      rows: tocRows,
    });
  }

  const mainPage = {
    id: 'main',
    title: systemName,
    titleHtml: colorizeSuitSymbols(stripSuitColorSpans(
      mainFmt.titleHtml || `<span style="font-weight: 700">${replaceSuitAbbreviations(systemName)}</span>`
    )),
    leftMargin: mainFmt.leftMargin ?? 20,
    rightMargin: mainFmt.rightMargin ?? 20,
    elementSpacing: mainFmt.elementSpacing ?? 30,
    elements: mainElements,
  };

  const pages = [mainPage];

  for (const sourcePage of sourcePages) {
    pages.push(buildPage(sourcePage, pageLookup, formatting));
  }

  return pages;
}

// ─── Reverse transform: PageData[] → intermediate + formatting ───

function htmlToBold(html) {
  return html
    .replace(/<span style="font-weight: 700">([^<]*)<\/span>/g, '**$1**')
    .replace(/<span style="font-weight:700">([^<]*)<\/span>/g, '**$1**')
    // Tiptap outputs <strong> instead of inline-style spans
    .replace(/<strong>([^<]*)<\/strong>/g, '**$1**')
    .replace(/<b>([^<]*)<\/b>/g, '**$1**');
}

function hyperlinksToRefs(html) {
  // Bridge links: data-link-mode attribute present
  // Use ([\s\S]*?) to match link text that may contain nested <span> tags (e.g. suit color spans)
  let result = html.replace(
    /<a\s[^>]*data-link-mode="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g,
    (_, mode, innerHtml) => {
      // Strip any nested HTML tags (suit color spans, etc.) to get plain text
      const text = innerHtml.replace(/<[^>]*>/g, '');
      if (mode === 'popup') return `[${text}|popup]`;
      if (mode === 'newtab') return `[${text}|newtab]`;
      return `[${text}|split]`;
    }
  );
  // External URLs: href starting with http(s), no data-link-mode
  result = result.replace(
    /<a\s[^>]*href="(https?:\/\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g,
    (match, url, innerHtml) => {
      if (match.includes('data-link-mode')) return match; // already handled above
      const text = innerHtml.replace(/<[^>]*>/g, '');
      return `[${text}](${url})`;
    }
  );
  return result;
}

function htmlListsToMarkdown(html) {
  // Use DOMParser for reliable nested list handling (regex fails with Tiptap's <p>-wrapped <li>)
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;

  function getDirectText(li) {
    // Get inline content of a <li>, skipping nested <ul>/<ol>
    const parts = [];
    for (const child of li.childNodes) {
      const tag = child.nodeName;
      if (tag === 'UL' || tag === 'OL') continue;
      if (tag === 'P') {
        parts.push(child.innerHTML);
      } else if (child.nodeType === Node.TEXT_NODE) {
        const t = child.textContent;
        if (t.trim()) parts.push(t);
      } else {
        parts.push(child.outerHTML);
      }
    }
    return parts.join('').trim();
  }

  function processList(listEl, indent) {
    const isOrdered = listEl.nodeName === 'OL';
    let num = 0;
    const lines = [];
    for (const child of Array.from(listEl.children)) {
      if (child.nodeName !== 'LI') continue;
      num++;
      const prefix = isOrdered ? `${num}. ` : '- ';
      const pad = '  '.repeat(indent);
      lines.push(`${pad}${prefix}${getDirectText(child)}`);
      // Recurse into any nested lists inside this <li>
      for (const sub of child.children) {
        if (sub.nodeName === 'UL' || sub.nodeName === 'OL') {
          lines.push(...processList(sub, indent + 1));
        }
      }
    }
    return lines;
  }

  function walk(node) {
    let result = '';
    const children = Array.from(node.childNodes);
    let i = 0;
    while (i < children.length) {
      const child = children[i];
      if (child.nodeName === 'UL' || child.nodeName === 'OL') {
        // Merge consecutive lists of the same type (Tiptap can split one <ol> into multiple)
        const listType = child.nodeName;
        const mergedLIs = [];
        while (i < children.length && children[i].nodeName === listType) {
          for (const li of Array.from(children[i].children)) {
            if (li.nodeName === 'LI') mergedLIs.push(li);
          }
          i++;
        }
        // Process all merged items as one continuous list
        const isOrdered = listType === 'OL';
        let num = 0;
        const lines = [];
        for (const li of mergedLIs) {
          num++;
          const prefix = isOrdered ? `${num}. ` : '- ';
          lines.push(`${prefix}${getDirectText(li)}`);
          for (const sub of li.children) {
            if (sub.nodeName === 'UL' || sub.nodeName === 'OL') {
              lines.push(...processList(sub, 1));
            }
          }
        }
        if (result && !result.endsWith('\n')) result += '\n';
        result += lines.join('\n');
        if (!result.endsWith('\n')) result += '\n';
      } else if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent;
        i++;
      } else {
        result += child.outerHTML;
        i++;
      }
    }
    return result;
  }

  return walk(root);
}

function htmlToContent(html) {
  if (!html) return '';
  let text = stripSuitColorSpans(html);
  text = hyperlinksToRefs(text);
  text = htmlToBold(text);
  text = htmlListsToMarkdown(text);
  // Tiptap wraps content in <p> tags — convert paragraph breaks to newlines
  text = text.replace(/<\/p>\s*<p[^>]*>/g, '\n');
  text = text.replace(/<br\s*\/?>/g, '\n');
  // Strip all remaining HTML tags (em, s, sub, sup, mark, span, p, etc.)
  // Use a pattern that only matches actual HTML tags (starting with < followed by / or a letter)
  // to avoid eating literal < in content like "< 6 of our suit"
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, '');
  return text.trim();
}

function reverseRow(row) {
  const cols = (row.columns || []).map(c =>
    c.html ? htmlToContent(c.html) : c.value || ''
  );
  const meaning = cols[0] || '';

  // If bidHtml has a link, extract cross-reference syntax from it
  let bid;
  if (row.bidHtml && row.bidHtml.includes('<a ')) {
    bid = htmlToContent(row.bidHtml);
  } else {
    bid = stripSuitColorSpans(row.bid || '');
  }
  const result = { bid, meaning, children: [] };

  // Preserve extra columns for multi-column tables
  if (cols.length > 1) {
    result.columns = cols;
  }

  if (row.children && row.children.length > 0) {
    result.children = row.children.map(reverseRow);
  }

  return result;
}

function reverseElement(el) {
  if (el.type === 'text') {
    return {
      type: 'note',
      content: el.htmlContent ? htmlToContent(el.htmlContent) : el.content || '',
    };
  }
  if (el.type === 'html') {
    return { type: 'html', content: el.content || '' };
  }
  if (el.type === 'bidtable') {
    return {
      type: 'table',
      name: el.showName === false ? '' : (el.name || ''),
      rows: (el.rows || []).map(reverseRow),
    };
  }
  return null;
}

/**
 * Extract merge info from rows as flat list of [rowIndex, colIndex] pairs.
 * Walks row tree depth-first with a flat counter so indices match applyRowMerges.
 */
function extractRowMerges(rows) {
  const merges = [];
  let idx = 0;
  const walk = (list) => {
    for (const row of list) {
      if (row.columns) {
        for (let c = 0; c < row.columns.length; c++) {
          if (row.columns[c].mergedWithPrevious) {
            merges.push([idx, c]);
          }
        }
      }
      idx++;
      if (row.children && row.children.length > 0) walk(row.children);
    }
  };
  walk(rows);
  return merges;
}

/**
 * Apply stored merge info back onto rows after rebuild from markdown.
 */
function applyRowMerges(rows, merges) {
  if (!merges || merges.length === 0) return;
  const mergeSet = new Set(merges.map(([r, c]) => `${r}:${c}`));
  let idx = 0;
  const walk = (list) => {
    for (const row of list) {
      if (row.columns) {
        for (let c = 0; c < row.columns.length; c++) {
          if (mergeSet.has(`${idx}:${c}`)) {
            row.columns[c].mergedWithPrevious = true;
          }
        }
      }
      idx++;
      if (row.children && row.children.length > 0) walk(row.children);
    }
  };
  walk(rows);
}

/**
 * Extract per-row HTML/styling as a flat array (depth-first).
 * Stores bidHtml, column html, and bidFillColor when present.
 */
function extractRowHtml(rows) {
  const fmt = [];
  let hasAny = false;
  const walk = (list) => {
    for (const row of list) {
      const rf = {};
      if (row.bidHtml && row.bidHtml !== row.bid) rf.bidHtml = row.bidHtml;
      if (row.bidFillColor) rf.bidFillColor = row.bidFillColor;
      // Store HTML for all columns that have it
      const cols = row.columns || [];
      const colsFmt = cols.map(c => c?.html ? { html: c.html } : null);
      const hasColHtml = colsFmt.some(c => c !== null);
      if (hasColHtml) {
        rf.columns = colsFmt;
      }
      // Backward compat: also store first column as rf.html
      if (cols[0]?.html) rf.html = cols[0].html;
      const hasFmt = Object.keys(rf).length > 0;
      if (hasFmt) hasAny = true;
      fmt.push(hasFmt ? rf : null);
      if (row.children?.length > 0) walk(row.children);
    }
  };
  walk(rows);
  return hasAny ? fmt : null;
}

/**
 * Apply stored per-row HTML/styling back onto rows after rebuild from markdown.
 */
/**
 * Refresh stale data-page-id and href attributes in stored link HTML
 * using the current page lookup, so links stay valid when page IDs change
 * (e.g. heading "Over 1m2h" → "Over 1m2♥" changes the generated ID).
 */
function refreshLinkPageIds(html, pageLookup) {
  if (!html || !html.includes('data-page-id')) return html;
  return html.replace(
    /<a\s([^>]*data-page-id="[^"]*"[^>]*)>([\s\S]*?)<\/a>/g,
    (match, attrs, innerHtml) => {
      // Extract clean display text from inner HTML
      const cleanText = stripSuitColorSpans(innerHtml).replace(/<[^>]+>/g, '').trim();
      const newPageId = pageLookup[cleanText.toLowerCase()];
      if (!newPageId) return match;
      const modeMatch = attrs.match(/data-link-mode="([^"]*)"/);
      const mode = modeMatch ? modeMatch[1] : 'split';
      // Re-colorize display text and rebuild link with current styles
      const displayText = colorizeSuitSymbols(replaceSuitAbbreviations(cleanText));
      if (mode === 'popup') return popupLink(displayText, newPageId);
      if (mode === 'newtab') return newtabLink(displayText, newPageId);
      return splitLink(displayText, newPageId);
    }
  );
}

function applyRowHtml(rows, rowHtml, pageLookup) {
  if (!rowHtml) return;
  let idx = 0;
  const walk = (list) => {
    for (const row of list) {
      const rf = rowHtml[idx];
      if (rf) {
        if (rf.bidHtml) {
          let bh = rf.bidHtml;
          if (bh.includes('<img ')) {
            // Hand diagram images: use as-is, no suit conversion (base64 would be corrupted)
            row.bidHtml = bh;
          } else if (bh.includes('<a ')) {
            // Refresh stale page IDs in links; skip replaceSuitAbbreviations
            // to avoid corrupting link text (e.g. "Club" → "♣")
            bh = refreshLinkPageIds(bh, pageLookup);
            row.bidHtml = colorizeSuitSymbols(stripSuitColorSpans(bh));
          } else {
            bh = stripSuitColorSpans(bh);
            bh = replaceSuitAbbreviations(bh);
            row.bidHtml = colorizeSuitSymbols(bh);
          }
        }
        if (rf.bidFillColor) row.bidFillColor = rf.bidFillColor;
        // Apply multi-column HTML with suit conversion for columns without links
        if (rf.columns && row.columns) {
          for (let i = 0; i < rf.columns.length && i < row.columns.length; i++) {
            if (rf.columns[i]?.html) {
              let colHtml = rf.columns[i].html;
              if (colHtml.includes('<a ')) {
                colHtml = refreshLinkPageIds(colHtml, pageLookup);
              }
              colHtml = colorizeSuitSymbols(stripSuitColorSpans(colHtml));
              row.columns[i].html = colHtml;
            }
          }
        } else if (rf.html && row.columns?.[0]) {
          // Backward compat: single column html
          let colHtml = rf.html;
          if (colHtml.includes('<a ')) {
            colHtml = refreshLinkPageIds(colHtml, pageLookup);
          }
          colHtml = colorizeSuitSymbols(stripSuitColorSpans(colHtml));
          row.columns[0].html = colHtml;
        }
      }
      idx++;
      if (row.children?.length > 0) walk(row.children);
    }
  };
  walk(rows);
}

/**
 * Extract formatting (display-only) from a PageData element.
 */
function extractElementFormatting(el) {
  if (el.type === 'html') {
    const fmt = {};
    if (el.width !== undefined && el.width !== 1160) fmt.width = el.width;
    return Object.keys(fmt).length > 0 ? fmt : null;
  }
  if (el.type === 'text') {
    const fmt = {};
    if (el.width !== undefined && el.width !== 580) fmt.width = el.width;
    if (el.borderColor && el.borderColor !== '#d1d5db') fmt.borderColor = el.borderColor;
    if (el.borderWidth !== undefined && el.borderWidth !== 1) fmt.borderWidth = el.borderWidth;
    if (el.fillColor && el.fillColor !== 'transparent') fmt.fillColor = el.fillColor;
    if (el.margin) fmt.margin = el.margin;
    // Preserve htmlContent if it contains styling or marks that markdown can't express
    if (el.htmlContent && (/margin-left|margin-right/.test(el.htmlContent) || /data-discussion-id/.test(el.htmlContent))) {
      fmt.htmlContent = el.htmlContent;
    }
    return Object.keys(fmt).length > 0 ? fmt : null;
  }
  if (el.type === 'bidtable') {
    const fmt = {};
    if (el.width !== undefined && el.width !== 620) fmt.width = el.width;
    if (el.columnWidths && JSON.stringify(el.columnWidths) !== '[480]') fmt.columnWidths = el.columnWidths;
    if (el.levelWidths && JSON.stringify(el.levelWidths) !== JSON.stringify({ 0: 80 })) fmt.levelWidths = el.levelWidths;
    if (el.gridlines && JSON.stringify(el.gridlines) !== JSON.stringify({ enabled: true, color: '#D1D5DB', width: 1 })) fmt.gridlines = el.gridlines;
    if (el.borderColor && el.borderColor !== '#d1d5db') fmt.borderColor = el.borderColor;
    if (el.borderWidth !== undefined && el.borderWidth !== 1) fmt.borderWidth = el.borderWidth;
    if (el.tocTable) fmt.tocTable = true;

    // Extract per-row merge info (mergedWithPrevious on columns)
    const merges = extractRowMerges(el.rows || []);
    if (merges.length > 0) fmt.rowMerges = merges;

    // Extract per-row HTML content (bidHtml, meaning html, bidFillColor)
    const rHtml = extractRowHtml(el.rows || []);
    if (rHtml) fmt.rowHtml = rHtml;

    return Object.keys(fmt).length > 0 ? fmt : null;
  }
  return null;
}

/**
 * Extract formatting from a PageData page object.
 */
function extractPageFormatting(pageData) {
  const fmt = {};
  if (pageData.leftMargin !== undefined && pageData.leftMargin !== 20) fmt.leftMargin = pageData.leftMargin;
  if (pageData.rightMargin !== undefined && pageData.rightMargin !== 20) fmt.rightMargin = pageData.rightMargin;
  if (pageData.elementSpacing !== undefined && pageData.elementSpacing !== 30) fmt.elementSpacing = pageData.elementSpacing;
  if (pageData.titleHtml && !pageData.titleHtml.match(/^<span style="font-weight: 700">.+<\/span>$/)) fmt.titleHtml = pageData.titleHtml;

  const elements = [...(pageData.elements || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const elFmts = elements.map(extractElementFormatting);

  if (elFmts.some(Boolean)) {
    fmt.elements = elFmts.map(f => f || {});
  }

  // Save element names/types so we can detect and fix order misalignment on reload
  const elNames = elements.map(el => {
    if (el.type === 'bidtable') return el.name || '';
    if (el.type === 'text') return `__text__${(el.content || '').slice(0, 30)}`;
    return `__${el.type}__`;
  });
  if (elNames.length > 0) fmt.elementNames = elNames;

  return Object.keys(fmt).length > 0 ? fmt : null;
}

/**
 * Reverse-transform pages back to intermediate structure + formatting.
 */
function reverseTransformPages(pages, originalSystem) {
  const pageMap = {};
  for (const p of pages) {
    pageMap[p.id] = p;
  }

  const mainPage = pageMap.main;
  const systemName = mainPage?.title || originalSystem.systemName || '';
  const description = originalSystem.description || '';

  // Rebuild pages as flat array
  const resultPages = (originalSystem.pages || []).map((origPage) => {
    const pageId = `page-${origPage.id}`;
    const pageData = pageMap[pageId];

    const page = {
      id: origPage.id,
      name: pageData?.title || origPage.name,
      elements: [],
    };

    if (pageData) {
      const elements = [...(pageData.elements || [])].sort(
        (a, b) => (a.order || 0) - (b.order || 0)
      );
      for (const el of elements) {
        const reversed = reverseElement(el);
        if (reversed) page.elements.push(reversed);
      }
    }

    return page;
  });

  // Include new pages created during this session (not in originalSystem)
  const existingIds = new Set(resultPages.map(p => `page-${p.id}`));
  for (const p of pages) {
    if (p.id === 'main' || existingIds.has(p.id)) continue;
    const page = {
      id: p.id.replace(/^page-/, ''),
      name: p.title || p.id.replace(/^page-/, ''),
      elements: [],
    };
    const elements = [...(p.elements || [])].sort(
      (a, b) => (a.order || 0) - (b.order || 0)
    );
    for (const el of elements) {
      const reversed = reverseElement(el);
      if (reversed) page.elements.push(reversed);
    }
    resultPages.push(page);
  }

  // Deduplicate pages — if multiple pages share the same name, keep only the first
  const seenNames = new Set();
  const deduped = [];
  for (const page of resultPages) {
    const key = page.name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    deduped.push(page);
  }
  resultPages.length = 0;
  resultPages.push(...deduped);

  // Build formatting object
  const formatting = {};
  for (const p of pages) {
    const pageFmt = extractPageFormatting(p);
    if (pageFmt) {
      formatting[p.id] = pageFmt;
    }
  }

  // Extract root elements from main page
  const rootElements = [];
  if (mainPage) {
    const sortedEls = [...(mainPage.elements || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    for (const el of sortedEls) {
      const reversed = reverseElement(el);
      if (reversed) rootElements.push(reversed);
    }
  }

  const system = { systemName, description, rootElements, pages: resultPages };
  return { system, formatting };
}

// ─── SystemEditor component ───

/**
 * SystemEditor — Top-level document editor component.
 *
 * Receives a markdown string + formatting object, parses and renders
 * the full document with TOC, chapter pages, split views, and popups.
 * On save/exit, serializes back to md + formatting.
 *
 * @param {string} md - System markdown content
 * @param {object} formatting - Display formatting overrides (keyed by page id)
 * @param {function} onSave - Called with { md, formatting } when user saves
 */
export function SystemEditor({ md, formatting: initialFormatting, onSave, onExit, startInEditMode = false, startPageId = null, docId = null, readOnly = false, documentDiscussions, onCreateDiscussion, onAddToDiscussion, onDiscussionHighlightClick, onAfterDiscussionApply }) {
  // Parse md once on mount (and when md prop changes)
  const systemRef = useRef(null);
  const formattingRef = useRef(initialFormatting || {});

  const initialPages = useMemo(() => {
    const system = parseSystemMd(md || '');
    systemRef.current = system;
    return transformToPages(system, initialFormatting || {});
  }, [md, initialFormatting]);

  const [pages, setPages] = useState(initialPages);
  const pagesRef = useRef(initialPages);
  const [splitStack, setSplitStack] = useState([]); // [{ page, sourcePageId }]
  const [popup, setPopup] = useState(null);
  const [isEditMode, setIsEditMode] = useState(startInEditMode);
  const [hasUnsavedSubPageChanges, setHasUnsavedSubPageChanges] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  // Sync sub-page edits back to pages state.
  // Uses pagesRef so handleSave always sees the latest data synchronously,
  // even if React hasn't flushed the setPages update yet.
  // Lightweight sync for main page: update ref only, no setPages (avoids re-render cascade)
  const handleMainPageChange = useCallback((pageData) => {
    pagesRef.current = pagesRef.current.map(p => p.id === pageData.id ? pageData : p);
  }, []);

  const handlePageChange = useCallback((pageData) => {
    pagesRef.current = pagesRef.current.map(p => p.id === pageData.id ? pageData : p);
    setPages(pagesRef.current);
    setHasUnsavedSubPageChanges(true);
  }, []);

  const handleSave = useCallback(async (pageData) => {
    // Build updated pages array synchronously from ref (not inside a state updater).
    // This is critical: the save dialog calls handleSave() then onExit() in the same
    // event handler. React batches both updates. If onExit unmounts this component
    // before the setPages updater runs, the save logic would never execute.
    const updated = pagesRef.current.map((p) => (p.id === pageData.id ? pageData : p));
    pagesRef.current = updated;
    setPages(updated);

    // Reverse-transform to get updated md + formatting
    if (onSave && systemRef.current) {
      const { system, formatting } = reverseTransformPages(updated, systemRef.current);
      // Preserve _highlights from previous formatting (not part of reverse transform)
      if (formattingRef.current._highlights) formatting._highlights = formattingRef.current._highlights;
      const newMd = toSystemMd(system);
      systemRef.current = system;
      formattingRef.current = formatting;
      await onSave({ md: newMd, formatting, systemName: system.systemName });

      // Re-run forward transform so suit symbols and cross-references are applied
      // to any pages that were created in-memory (not from markdown)
      const refreshedPages = transformToPages(system, formatting);
      pagesRef.current = refreshedPages;
      setPages(refreshedPages);
    }

    setHasUnsavedSubPageChanges(false);
  }, [onSave]);

  // Save all pages as-is (used by tab-bar exit dialog)
  const handleFullSave = useCallback(async () => {
    if (onSave && systemRef.current) {
      const { system, formatting } = reverseTransformPages(pagesRef.current, systemRef.current);
      // Preserve _highlights from previous formatting (not part of reverse transform)
      if (formattingRef.current._highlights) formatting._highlights = formattingRef.current._highlights;
      const newMd = toSystemMd(system);
      systemRef.current = system;
      formattingRef.current = formatting;
      await onSave({ md: newMd, formatting, systemName: system.systemName });
    }
    setHasUnsavedSubPageChanges(false);
  }, [onSave]);

  // Tab-bar exit: show save dialog if in edit mode, otherwise exit directly
  const handleExitClick = useCallback(() => {
    if (isEditMode) {
      setShowExitDialog(true);
    } else {
      onExit?.();
    }
  }, [isEditMode, onExit]);

  const handleHyperlinkClick = useCallback((target) => {
    // newtab mode: open page in a new browser tab
    if (target.mode === 'newtab' && target.pageId) {
      const url = new URL(window.location.href);
      if (docId) url.searchParams.set('doc', docId);
      url.searchParams.set('page', target.pageId);
      window.open(url.toString(), '_blank');
      return;
    }

    const targetPage = pagesRef.current.find((p) => p.id === target.pageId);
    if (!targetPage) return;

    const position = target.position || { x: 400, y: 300 };

    if (target.mode === 'popup') {
      setPopup({ position, page: targetPage });
    } else {
      // Split mode: sibling replacement — find source page, dismiss everything after it
      setSplitStack((prev) => {
        const sourcePageId = target.sourcePageId;
        let sourceIndex = -1; // -1 = main page (before any splits)
        if (sourcePageId) {
          sourceIndex = prev.findIndex((sp) => sp.page.id === sourcePageId);
          // If source not found in split stack and not main, append after last
          if (sourceIndex === -1 && sourcePageId !== 'main') {
            sourceIndex = prev.length - 1;
          }
        }
        const kept = prev.slice(0, sourceIndex + 1);
        return [...kept, { page: targetPage }];
      });
    }
  }, [docId]);

  // Create a new page (chapter) and return its page ID
  const handleCreatePage = useCallback((pageName) => {
    const slug = pageName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const pageId = `page-${slug}`;

    // Check if page already exists
    if (pagesRef.current.some(p => p.id === pageId)) return pageId;

    // Create new page data object
    const newPage = {
      id: pageId,
      title: pageName,
      titleHtml: `<span style="font-weight: 700">${colorizeSuitSymbols(pageName)}</span>`,
      leftMargin: 20,
      rightMargin: 20,
      elementSpacing: 30,
      elements: [],
    };

    // Add to pages ref immediately (so link clicks can find it right away)
    pagesRef.current = [...pagesRef.current, newPage];

    // Add to intermediate structure so it persists on save
    if (systemRef.current) {
      const chapterId = slug;
      systemRef.current.pages = [
        ...(systemRef.current.pages || []),
        { id: chapterId, name: pageName, elements: [] },
      ];
    }

    // Only update the ref — no setPages here. The new page is already in
    // pagesRef.current so handleHyperlinkClick can find it. availablePages
    // will pick it up on the next natural render (e.g. when the user edits
    // something else). Calling setPages here triggers a re-render cascade
    // through EditorContext that can wipe the link from the calling editor.
    setHasUnsavedSubPageChanges(true);

    return pageId;
  }, []);

  const availablePages = useMemo(
    () => pages.filter((p) => p.id !== 'main').map((p) => ({ id: p.id, name: p.title })),
    [pages]
  );

  const editorCtx = useMemo(() => ({
    availablePages,
    onHyperlinkClick: handleHyperlinkClick,
    onCreatePage: handleCreatePage,
    documentDiscussions: documentDiscussions || [],
    onCreateDiscussion: onCreateDiscussion || null,
    onAddToDiscussion: onAddToDiscussion || null,
    onDiscussionHighlightClick: onDiscussionHighlightClick || null,
    onAfterDiscussionApply: onAfterDiscussionApply || handleFullSave,
  }), [availablePages, handleHyperlinkClick, handleCreatePage, documentDiscussions, onCreateDiscussion, onAddToDiscussion, onDiscussionHighlightClick, onAfterDiscussionApply, handleFullSave]);

  const mainPage = (startPageId && pages.find((p) => p.id === startPageId)) || pages.find((p) => p.id === 'main');

  if (!mainPage) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
        No content to display.
      </div>
    );
  }

  // Build full page chain: [main, split0, split1, ...]
  // Last 2 are visible side-by-side; everything before is breadcrumb tabs.
  const pageChain = [{ page: mainPage, isMain: true }, ...splitStack.map(sp => ({ page: sp.page, isMain: false }))];
  const visibleStartIndex = Math.max(0, pageChain.length - 2);
  const breadcrumbPages = pageChain.slice(0, visibleStartIndex);
  const visiblePages = pageChain.slice(visibleStartIndex);

  return (
    <EditorProvider value={editorCtx}>
      <div style={{
        height: '100vh',
        boxSizing: 'border-box',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Breadcrumb tabs — shown when chain exceeds 2 pages */}
        {breadcrumbPages.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 32px',
            backgroundColor: '#e5e7eb',
            flexShrink: 0,
            overflowX: 'auto',
          }}>
            {breadcrumbPages.map((entry, i) => (
              <div key={entry.page.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => {
                    // Jump to this breadcrumb: slice splitStack so this page becomes visible
                    // If it's the main page (i === 0 and isMain), keep only first split entry
                    // Otherwise keep splitStack up to index that makes this page the second-to-last visible
                    if (entry.isMain) {
                      // Show main + first split (if any), drop everything after first split
                      setSplitStack(prev => prev.slice(0, 1));
                    } else {
                      // This is splitStack[i - breadcrumbAdjust]. We want this page + its child visible.
                      // entry is at pageChain index i, which is splitStack index (i - 1) if main is at 0.
                      // We want splitStack trimmed so this entry is second-to-last in the chain.
                      const splitIndex = i - (pageChain[0].isMain ? 1 : 0);
                      setSplitStack(prev => prev.slice(0, splitIndex + 2));
                    }
                  }}
                  style={{
                    padding: '4px 12px',
                    fontSize: '13px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    background: 'white',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                >
                  {entry.page.title || entry.page.id}
                </button>
                <span style={{ color: '#9ca3af', fontSize: '13px' }}>›</span>
              </div>
            ))}
            {/* Current visible pages label */}
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
              {visiblePages[0]?.page.title || visiblePages[0]?.page.id}
            </span>

            {/* Edit / Exit controls when main page is a tab */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexShrink: 0 }}>
              {!readOnly && !isEditMode && (
                <button
                  onClick={() => { setIsEditMode(true); }}
                  style={{
                    padding: '4px 12px', fontSize: '13px', border: '1px solid #d1d5db',
                    borderRadius: '4px', background: 'white', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                >
                  Edit
                </button>
              )}
              {onExit && (
                <button
                  onClick={handleExitClick}
                  style={{
                    padding: '4px 12px', fontSize: '13px', border: '1px solid #d1d5db',
                    borderRadius: '4px', background: 'white', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                >
                  Exit
                </button>
              )}
            </div>
          </div>
        )}

        {/* Visible pages — always the last 2 in the chain, side by side */}
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          padding: '32px',
          overflow: 'hidden',
        }}>
          {visiblePages.map((entry, i) => {
            const isFirst = i === 0;
            if (entry.isMain) {
              return (
                <Page
                  key={entry.page.id}
                  initialPage={entry.page}
                  onSave={handleSave}
                  onExit={onExit}
                  onPageChange={handleMainPageChange}
                  mainPageId="main"
                  startInEditMode={readOnly ? false : startInEditMode}
                  readOnly={readOnly}
                  onEditModeChange={setIsEditMode}
                  externalDirty={hasUnsavedSubPageChanges}
                />
              );
            }
            // Split page — find its index in splitStack for onClose
            const splitIndex = splitStack.findIndex(sp => sp.page.id === entry.page.id);
            return (
              <Page
                key={entry.page.id}
                initialPage={entry.page}
                mode="split"
                onSave={handleSave}
                onClose={() => setSplitStack((prev) => prev.slice(0, splitIndex))}
                onPageChange={handlePageChange}
                mainPageId="main"
                editMode={readOnly ? false : isEditMode}
                readOnly={readOnly}
              />
            );
          })}
        </div>

        {popup && (
          <PopupView position={popup.position} zIndex={200}>
            <Page
              key={popup.page.id}
              initialPage={popup.page}
              mode="popup"
              maxHeight="70vh"
              onClose={() => setPopup(null)}
              onPageChange={handlePageChange}
              mainPageId="main"
              editMode={readOnly ? false : isEditMode}
              readOnly={readOnly}
            />
          </PopupView>
        )}

        {/* Save/Discard dialog for tab-bar exit */}
        {showExitDialog && (
          <div
            style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
            }}
            onClick={() => setShowExitDialog(false)}
          >
            <div
              style={{
                background: 'white', borderRadius: '8px', padding: '24px',
                minWidth: '300px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p style={{ fontSize: '15px', color: '#374151', marginBottom: '20px' }}>
                You have unsaved changes.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  onClick={() => { setShowExitDialog(false); onExit?.(); }}
                  style={{
                    padding: '6px 14px', fontSize: '14px', border: '1px solid #d1d5db',
                    borderRadius: '6px', background: 'white', cursor: 'pointer',
                  }}
                >
                  Discard changes
                </button>
                <button
                  onClick={async () => { setShowExitDialog(false); await handleFullSave(); onExit?.(); }}
                  style={{
                    padding: '6px 14px', fontSize: '14px', borderRadius: '6px', cursor: 'pointer',
                    border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', fontWeight: 500,
                  }}
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EditorProvider>
  );
}
