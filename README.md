# BSD Library — Bridge System Document Components

React component library for displaying and editing bridge bidding system documents and game analyses. The primary entry point is `SystemEditor`, which handles the complete **md + formatting → display → save → md + formatting** pipeline.

## Architecture

```
                  ┌─────────────────────────────────────────────┐
                  │                SystemEditor                  │
                  │                                              │
  md + formatting │  parseSystemMd ──► transformToPages ──► Render│
       ──────────►│                                              │
                  │  toSystemMd ◄── reverseTransformPages ◄── Save│
       ◄──────────│                                              │
  md + formatting │  (suit symbols, cross-refs, formatting)      │
                  └─────────────────────────────────────────────┘
```

### Pipeline

1. **Parse**: `parseSystemMd(md)` → intermediate structure (`{ systemName, description, rootElements, pages[] }`)
2. **Transform**: `transformToPages(system, formatting)` → renderable `PageData[]` with suit symbol colorization, cross-reference link injection, formatting overlays
3. **Render**: `Page` components with `BidTable` and `TextEl` elements
4. **Reverse Transform**: `reverseTransformPages(pages, originalSystem)` → updated intermediate + formatting
5. **Serialize**: `toSystemMd(system)` → markdown string

### What lives where

- **Markdown** is canonical content (headings, tables, prose, cross-references)
- **Formatting** is visual-only JSONB (widths, colors, gridlines, row HTML overrides, column widths)
- They are stored and round-tripped independently

## Installation

Add as a local dependency:

```json
{ "dependencies": { "bsd-lib": "file:../bsd-lib" } }
```

### CSS Setup

```css
@import "tailwindcss";
@source "../node_modules/bsd-lib/**/*.{js,jsx}";
@import "bsd-lib/styles.css";
```

### Peer Dependencies

react ^19, react-dom ^19, re-resizable ^6, lucide-react ^0.5, tailwindcss ^4, @tiptap/* ^3

## Quick Start

```jsx
import { SystemEditor } from 'bsd-lib';

<SystemEditor
  docId={doc.id}
  md={doc.md}
  formatting={doc.formatting}
  onSave={async ({ md, formatting, systemName }) => {
    await saveToDb({ md, formatting, name: systemName });
  }}
  onExit={() => navigate('/dashboard')}
  startInEditMode={false}
  startPageId={null}  // optional: deep-link to a specific page
/>
```

## Exports (`index.js`)

| Export | Description |
|--------|-------------|
| `SystemEditor` | Top-level component — the primary entry point |
| `parseSystemMd` | Markdown → intermediate structure |
| `toSystemMd` | Intermediate structure → markdown |
| `Page` | Page renderer (used internally by SystemEditor) |
| `PopupView` | Floating popup container |
| `PageFormatPanel` | Page margins/spacing panel |
| `TitleBar` | Editable page title |
| `BidTable` | Nested bid table component |
| `TextEl` | Rich text editor (default + cell modes) |

## Markdown Format

```markdown
---
system: System Name
description: Optional description
---

##
| [Page One|split] | summary |
| [Page Two|popup] | summary |

# Page One

## Table Name
| 1NT | 15-17, balanced |
|   2♣ | Stayman |
|     2♦ | No 4-card major |

Prose text with **bold** and [Page Two|popup] links.

### Subpage Name

##
| bid | meaning |
```

**Rules:**
- `#` or `###` = page heading
- `##` = table heading (within a page)
- `| bid | meaning |` = table rows; nesting via 2-space indent in bid column
- Cross-references: `[Page Name]` (split), `[Page Name|popup]`, `[Page Name|newtab]`
- External links: `[text](https://url)`
- Prose between structural markers = note elements

## Suit Symbol Pipeline

```
On load:  "1c" → "1♣"  (replaceSuitAbbreviations)
          "1♣" → "1<span style='color:#007700'>♣</span>"  (colorizeSuitSymbols)

On save:  colored spans → plain symbols  (stripSuitColorSpans)
```

**Critical**: `replaceSuitAbbreviations` must NOT run on:
- Link text (corrupts "Club" → "♣")
- Base64 data (corrupts `<img>` hand diagrams)
- HTML href attributes (corrupts page IDs like `page-over-1m2h`)

## Link System

Four link modes:

| Mode | Markdown | Behavior |
|------|----------|----------|
| `split` | `[Name\|split]` or `[Name]` | Opens page in adjacent split pane |
| `popup` | `[Name\|popup]` | Opens page in floating popup overlay |
| `newtab` | `[Name\|newtab]` | Opens page in new browser tab (`?doc=&page=`) |
| `url` | `[text](https://...)` | Opens external URL in new tab |

Links are stored as `<a>` tags with `data-page-id` and `data-link-mode` attributes.
`refreshLinkPageIds()` corrects stale page IDs using the current page name → ID lookup.

## Game Display

Games use the same SystemEditor pipeline but with different content:

- **Column 1 (bid)**: Hand diagram SVG as base64 `<img>` in `bidHtml` — rendered as raw HTML, not through Tiptap
- **Column 2**: Bidding details — non-editable rich text
- **Column 3**: Analysis — editable via native `contentEditable` to preserve inline bullet styles (`padding-left` + `text-indent` for hanging indent)

The `htmlToGame()` converter (in bsd-app) transforms tournament HTML into md + formatting with this 3-column layout.

## Key Components

### SystemEditor (`components/SystemEditor.jsx`)
Orchestrator for the full pipeline. Manages pages state, handles save/load, split/popup views, page creation, hyperlink click routing.

### Page (`components/page/Page.jsx`)
Container for a page. Modes: main, split, popup. Edit/view toggle, save/discard dialog, element selection, insert menu (add Table or Text), copy/paste elements.

### BidTable (`components/bid_table/BidTable.jsx`)
Nested bid table. Row operations: add sibling/child, delete, collapse, copy/paste. Column operations: resize, merge, add/delete. Undo (Ctrl+Z). Optional name header.

### TextEl (`components/text_el/TextEl.jsx`)
Rich text editor (Tiptap). Two modes: `default` (standalone with border/fill/resize) and `cell` (for BidTable cells). Three menus: text format, block format, element format. Hyperlink menu with 4 modes (popup/split/newtab/url).

## File Structure

```
bsd-lib/
  index.js                        Main exports
  package.json                    Peer dependencies
  styles.css                      Contenteditable CSS
  lib/
    parseSystemMd.js              Markdown → intermediate structure
    toSystemMd.js                 Intermediate → markdown
    suitSymbols.js                Suit abbreviation/symbol/color conversion
  components/
    SystemEditor.jsx              Pipeline orchestrator (primary entry point)
    EditorContext.js               React context (availablePages, callbacks)
    page/
      Page.jsx                    Page component (4 modes)
      PopupView.jsx               Floating popup container
      TitleBar.jsx                Editable page title
      PageFormatPanel.jsx         Margins + spacing panel
    bid_table/
      BidTable.jsx                N-column hierarchical table
      BidTableRow.jsx             Single row + recursion + hand diagrams
      BidTableFormatPanel.jsx     Border, gridlines, row height
      BidTableNameHeader.jsx      Optional table name row
      ColorPicker.jsx             Bid cell fill color
    text_el/
      TextEl.jsx                  Rich text element (default + cell modes)
      useTiptapEditor.js          Tiptap editor setup + hyperlink apply
      BridgeLink.js               Custom Tiptap link extension
      TextFormatPanel.jsx         Bold, italic, color, hyperlink
      BlockFormatBar.jsx          Alignment, lists
      ElementFormatPanel.jsx      Border, fill, copy, delete, move
      HyperlinkMenu.jsx           Link creation (popup/split/newtab/url)
      Ruler.jsx                   Paragraph indent ruler
      ParagraphIndent.js          Indent Tiptap extension
      FontSize.js                 Font size Tiptap extension
      ListStyleType.js            List style Tiptap extension
      SmartLift.js                Smart list promotion (Shift+Tab)
  docs/
    page.md                       Page module docs
    bid_table.md                  BidTable module docs
    text_el.md                    TextEl module docs
  test-data/
    verify-roundtrip.mjs          Round-trip verification script
    *.md, *.json                  Test data files
```
