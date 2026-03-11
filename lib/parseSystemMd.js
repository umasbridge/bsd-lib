/**
 * parseSystemMd.js — Markdown → Intermediate Structure
 *
 * Parses a system.md string into the intermediate bidding system object:
 * { systemName, description, pages[] }
 *
 * Each page has: { id, name, summary, elements[] }
 * Elements are: { type: 'note', content } or { type: 'table', name, rows[] }
 * Rows are: { bid, meaning, children[] }
 */


/**
 * Build a nested row tree from flat rows with level information.
 */
function buildRowTree(flatRows) {
  const roots = [];
  const stack = []; // Each entry: { row, level }

  for (const { level, bid, meaning, columns } of flatRows) {
    const row = { bid, meaning, children: [] };
    if (columns && columns.length > 1) {
      row.columns = columns;
    }

    // Pop stack until we find a parent at a lower level
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(row);
    } else {
      stack[stack.length - 1].row.children.push(row);
    }

    stack.push({ row, level });
  }

  return roots;
}

/**
 * Parse a system.md string into the intermediate structure.
 *
 * @param {string} md - The markdown string
 * @returns {{ systemName: string, description: string, pages: object[] }}
 */
export function parseSystemMd(md) {
  const lines = md.split('\n');

  let systemName = '';
  let description = '';
  let inFrontmatter = false;
  let frontmatterStarted = false;

  const rootElements = []; // elements before any # heading
  const pages = [];
  let currentPage = null;
  let currentTable = null;
  let proseLines = [];
  let htmlLines = null; // non-null when inside ~~~html block

  function flushProse() {
    const text = proseLines.join('\n').trim();
    if (text) {
      const target = currentPage ? currentPage.elements : rootElements;
      target.push({ type: 'note', content: text });
    }
    proseLines = [];
  }

  function flushTable() {
    if (currentTable) {
      if (currentTable.flatRows.length > 0) {
        const tableEl = {
          type: 'table',
          name: currentTable.name,
          rows: buildRowTree(currentTable.flatRows),
        };
        const target = currentPage ? currentPage.elements : rootElements;
        target.push(tableEl);
      }
      currentTable = null;
    }
  }

  /**
   * Check if a line is a table row: starts and ends with |, has at least 2 | separators.
   */
  function parseRowLine(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;

    // Mask | inside [...] brackets so cross-references like [Name|popup]
    // don't get split into separate columns.
    const PIPE_PLACEHOLDER = '\x00PIPE\x00';
    let masked = line.replace(/\[([^\]]*)\]/g, (m) => m.replace(/\|/g, PIPE_PLACEHOLDER));

    const parts = masked.split('|');
    if (parts.length < 4) return null;

    // Restore masked pipes
    const restore = (s) => s.replace(new RegExp(PIPE_PLACEHOLDER.replace(/\x00/g, '\\x00'), 'g'), '|');

    const bidPart = restore(parts[1]);
    const leadingSpaces = Math.max(0, bidPart.match(/^(\s*)/)[1].length - 1);
    const level = Math.floor(leadingSpaces / 2);
    const bid = bidPart.trim();
    const columns = parts.slice(2, -1).map(c => restore(c).trim());
    const meaning = columns[0] || '';

    return { level, bid: bid || '', meaning, columns };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // --- Frontmatter ---
    if (trimmed === '---') {
      if (!frontmatterStarted) {
        inFrontmatter = true;
        frontmatterStarted = true;
        continue;
      } else if (inFrontmatter) {
        inFrontmatter = false;
        continue;
      }
      // --- Note separator: --- inside a page splits consecutive prose blocks ---
      if (currentPage) {
        flushProse();
        flushTable();
        continue;
      }
    }

    if (inFrontmatter) {
      const match = trimmed.match(/^(\w+):\s*(.*)/);
      if (match) {
        const [, key, value] = match;
        if (key === 'system') systemName = value;
        if (key === 'description') description = value;
      }
      continue;
    }

    // --- HTML fenced block: ~~~html ... ~~~ ---
    if (trimmed === '~~~html') {
      flushProse();
      flushTable();
      htmlLines = [];
      continue;
    }
    if (htmlLines !== null) {
      if (trimmed === '~~~') {
        const target = currentPage ? currentPage.elements : rootElements;
        target.push({ type: 'html', content: htmlLines.join('\n') });
        htmlLines = null;
      } else {
        htmlLines.push(line);
      }
      continue;
    }

    // --- Table heading: ## Name (must check before page heading) ---
    const tableMatch = trimmed.match(/^##(?:\s+([^#].*?))?$/);
    if (tableMatch) {
      flushProse();
      flushTable();

      const name = (tableMatch[1] || '').trim();
      currentTable = { name, flatRows: [] };
      continue;
    }

    // --- Page heading: # Name or ### Name (both create pages) ---
    const pageMatch = trimmed.match(/^#{1,3}\s+([^#].*)$/);

    if (pageMatch) {
      flushProse();
      flushTable();

      const name = pageMatch[1].trim();
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      currentPage = { id, name, elements: [] };
      pages.push(currentPage);
      continue;
    }

    // --- Table row ---
    const rowData = parseRowLine(line);
    if (rowData) {
      // If we encounter a row without a table heading, auto-start an unnamed table
      if (!currentTable) {
        flushProse();
        currentTable = { name: '', flatRows: [] };
      }
      currentTable.flatRows.push(rowData);
      continue;
    }

    // --- Blank line ---
    if (trimmed === '') {
      // Blank lines inside prose are preserved (as empty lines) — they don't split notes.
      // Only structural markers (headings, table rows, ## names) flush prose.
      if (proseLines.length > 0) {
        proseLines.push('');
      }
      continue;
    }

    // --- Regular text (prose) ---
    // If we're collecting table rows and hit prose, flush the table
    if (currentTable) {
      flushTable();
    }
    proseLines.push(line);
  }

  // Final flush
  flushProse();
  flushTable();

  return { systemName, description, rootElements, pages };
}
