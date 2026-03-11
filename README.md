# BSD Library — Bridge System Document Components

React component library for displaying and editing bridge bidding system documents. Provides a self-contained `Page` component that renders a complete document page with bid tables, rich text elements, hyperlinked navigation, and full inline editing.

## Installation

Add as a local dependency in your `package.json`:

```json
{
  "dependencies": {
    "bsd-lib": "file:../bsd-lib"
  }
}
```

Then run `npm install`.

### CSS Setup

Your app's CSS must include:

```css
@import "tailwindcss";
@source "../node_modules/bsd-lib/**/*.{js,jsx}";
@import "bsd-lib/styles.css";
```

- `@source` tells Tailwind to scan bsd-lib for utility classes
- `@import "bsd-lib/styles.css"` loads contenteditable styles needed by the library

### Peer Dependencies

These must be installed in your app:

| Dependency | Version | Purpose |
|------------|---------|---------|
| `react` | ^19 | Core framework |
| `react-dom` | ^19 | Portal rendering |
| `re-resizable` | ^6 | Element and column resize handles |
| `lucide-react` | ^0.5 | Icons |
| `tailwindcss` | ^4 | Styling (utility classes used throughout) |

## Quick Start

```jsx
import { Page, PopupView } from 'bsd-lib';

<Page
  initialPage={pageData}
  mode="main"
  onSave={(data) => savePage(data)}
  availablePages={pages}
  mainPageId={pageData.id}
  onHyperlinkClick={handleNavigation}
  startInEditMode={true}
/>
```

## Components

### Page

The main entry point. A self-contained page component that manages its own state. The parent only provides initial data and handles save/navigation callbacks.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `initialPage` | `PageData` | Page data (title, elements, margins, spacing) |
| `mode` | `'main' \| 'split' \| 'popup' \| 'newpage'` | Display mode (default: `'main'`) |
| `onSave` | `(pageData) => void` | Main mode: called on save |
| `onClose` | `() => void` | Sub-pages: called on X close |
| `onPageChange` | `(pageData) => void` | Every mutation: live sync to parent |
| `availablePages` | `[{id, name}]` | Pages for hyperlink targets |
| `mainPageId` | `string` | Main page ID (excluded from link targets) |
| `onHyperlinkClick` | `(target) => void` | Hyperlink navigation callback |
| `startInEditMode` | `boolean` | Start in edit mode (default: `false`) |
| `maxHeight` | `string` | Popup mode: CSS max-height (e.g. `'70vh'`) |

### PopupView

Floating container for popup-mode pages. Positions near click point, supports drag, adjusts to viewport.

```jsx
<PopupView position={{ x: clickX, y: clickY }} zIndex={200}>
  <Page mode="popup" ... />
</PopupView>
```

### BidTable

Hierarchical N-column table for bidding sequences. Nested rows, column resize, merge, copy/paste, collapse/expand. Used internally by Page but also available standalone.

### TextEl

Rich text element with inline formatting (bold, italic, color, hyperlinks), alignment, lists. Two modes: `default` (standalone page element) and `cell` (embedded in BidTable cells).

## Page Modes

| Mode | Use Case | Save | Close | Height |
|------|----------|------|-------|--------|
| `main` | Primary document | Save button | — | Fills parent |
| `split` | Adjacent linked page | No (auto-sync) | X button | Fills parent |
| `popup` | Floating linked page | No (auto-sync) | X button | Fits content (up to max) |
| `newpage` | New tab linked page | No (auto-sync) | X button | Fills parent |

## Data Structures

### PageData

```js
{
  id: 'page-1',
  title: '1NT Opening',
  titleHtml: '<span style="font-weight: 700">1NT Opening</span>',
  elements: [
    {
      id: 'el-1',
      type: 'bidtable',
      order: 1,
      rows: [
        {
          id: '1',
          bid: '1NT',
          columns: [
            { value: '15-17 HCP, balanced' },
            { value: 'Forcing' },
          ],
          children: [ /* nested rows */ ],
        },
      ],
      name: '1NT System',
      showName: true,
      width: 680,
      columnWidths: [450, 130],
      levelWidths: { 0: 80 },
      gridlines: { enabled: true, color: '#D1D5DB', width: 1 },
      borderColor: '#d1d5db',
      borderWidth: 1,
    },
    {
      id: 'el-2',
      type: 'text',
      order: 2,
      content: 'Notes about this system.',
      htmlContent: '<b>Notes</b> about this system.',
      width: 500,
      borderColor: '#d1d5db',
      borderWidth: 2,
      fillColor: 'transparent',
    },
  ],
  leftMargin: 20,
  rightMargin: 20,
  elementSpacing: 43,
}
```

### Hyperlinks

Hyperlinks are embedded in rich text content as `<a>` tags:

```html
<a href="bridge://page-2/popup"
   data-page-id="page-2"
   data-link-mode="popup"
   style="color: #2563eb; text-decoration: underline; cursor: pointer;">
  Link text
</a>
```

When clicked, `onHyperlinkClick` fires with:

```js
{
  pageId: 'page-2',
  pageName: 'Link text',
  mode: 'popup',           // 'popup' | 'split' | 'newpage'
  position: { x: 450, y: 300 },  // click coordinates
}
```

### Link Filtering Rules

- A page cannot link to itself
- The main page (`mainPageId`) cannot be linked from anywhere
- Filtering is automatic — Page removes excluded pages before passing to child components

## Integration Example

Full example with main page, split view, and popup:

```jsx
import { useState } from 'react';
import { Page, PopupView } from 'bsd-lib';

const ALL_PAGES = [
  { id: 'page-1', name: 'Opening Bids' },
  { id: 'page-2', name: 'Responses' },
  { id: 'page-3', name: 'Slam Bidding' },
];

function App() {
  const [mainPage, setMainPage] = useState(loadPage('page-1'));
  const [splitPage, setSplitPage] = useState(null);
  const [popup, setPopup] = useState(null);

  const handleHyperlinkClick = (target) => {
    const page = loadPage(target.pageId);
    if (!page) return;

    if (target.mode === 'popup') {
      setPopup({ position: target.position, page });
    } else if (target.mode === 'split') {
      setSplitPage(page);
    } else if (target.mode === 'newpage') {
      window.open(`/page/${target.pageId}`, '_blank');
    }
  };

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      <Page
        initialPage={mainPage}
        mode="main"
        onSave={setMainPage}
        availablePages={ALL_PAGES}
        mainPageId={mainPage.id}
        onHyperlinkClick={handleHyperlinkClick}
        startInEditMode={true}
      />

      {splitPage && (
        <Page
          key={splitPage.id}
          initialPage={splitPage}
          mode="split"
          onClose={() => setSplitPage(null)}
          onPageChange={(data) => console.log('changed:', data)}
          availablePages={ALL_PAGES}
          mainPageId={mainPage.id}
          onHyperlinkClick={handleHyperlinkClick}
        />
      )}

      {popup && (
        <PopupView position={popup.position} zIndex={200}>
          <Page
            key={popup.page.id}
            initialPage={popup.page}
            mode="popup"
            maxHeight="70vh"
            onClose={() => setPopup(null)}
            onPageChange={(data) => console.log('changed:', data)}
            availablePages={ALL_PAGES}
            mainPageId={mainPage.id}
            onHyperlinkClick={handleHyperlinkClick}
          />
        </PopupView>
      )}
    </div>
  );
}
```

## File Structure

```
bsd-lib/
  package.json                    Package metadata + peer dependencies
  index.js                        Main exports
  styles.css                      Contenteditable CSS (import in your app)
  utils/
    rte/
      index.js                    Rich text utility exports
      history.js                  Undo/redo controller
      selectionBookmarks.js       Selection preservation
      normalizeNodeTree.js        DOM normalization
      canonicalizeStyle.js        Style normalization
      pasteSanitizer.js           Paste HTML sanitization
  components/
    page/
      Page.jsx                    Main page component (4 modes)
      PopupView.jsx               Floating container for popups
      TitleBar.jsx                Page title (TextEl wrapper)
      PageFormatPanel.jsx         Margins + spacing panel
      types.js                    Constants + JSDoc types
      index.js                    Barrel exports
    bid_table/
      BidTable.jsx                N-column hierarchical table
      BidTableRow.jsx             Single row + recursion
      BidTableFormatPanel.jsx     Border, gridlines, row height
      BidTableNameHeader.jsx      Optional table name row
      ColorPicker.jsx             Bid cell fill color
      types.js                    Constants + JSDoc types
      index.js                    Barrel exports
    text_el/
      TextEl.jsx                  Rich text element (default + cell modes)
      useRichText.js              ContentEditable hook
      TextFormatPanel.jsx         Bold, italic, color, hyperlink
      BlockFormatBar.jsx          Alignment, lists
      ElementFormatPanel.jsx      Border, fill, copy, delete, move
      HyperlinkMenu.jsx           Page hyperlink creation
      types.js                    Constants + JSDoc types
      index.js                    Barrel exports
  docs/
    page.md                       Page module documentation
    bid_table.md                  BidTable module documentation
    text_el.md                    TextEl module documentation
  README.md                       This file
```

## Detailed Documentation

- [Page module](docs/page.md) — Page modes, save/discard, format panel, element operations
- [BidTable module](docs/bid_table.md) — Row operations, column architecture, merge, copy/paste, resize
- [TextEl module](docs/text_el.md) — Rich text modes, format menus, hyperlinks, selection behavior
