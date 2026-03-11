# Page Module

Self-contained page component for displaying and editing bridge system document pages. Manages its own state internally; interaction with the parent is limited to receiving initial data and emitting save/change/navigation callbacks.

## Files

| File | Purpose |
|------|---------|
| `Page.jsx` | Main component. State management, element CRUD, copy/paste, save/discard, view/edit modes, 4 page modes. |
| `PopupView.jsx` | Floating positioned container for popup pages. Provides drag, boundary adjustment, shadow. |
| `TitleBar.jsx` | Page title row. Wrapper around TextEl in default mode with transparent border/fill. |
| `PageFormatPanel.jsx` | Format panel for page-level settings (margins, element spacing). Shown on border click. |
| `types.js` | Type definitions (JSDoc), layout constants (margins, spacing, width limits). |
| `index.js` | Barrel exports. |

## Page Modes

| Mode | Description | Top Right | Bottom Bar | Editing |
|------|-------------|-----------|------------|---------|
| `'main'` | Primary page. User-controlled save. | — | Insert + Save/Edit toggle | Toggle via button |
| `'split'` | Opens adjacent to caller via hyperlink. | X close | Insert only | Always editable |
| `'popup'` | Floating popup via hyperlink. Height fits content. | X close | Insert only | Always editable |
| `'newpage'` | Opens in a new browser tab. | X close | Insert only | Always editable |

## Data Structure

### PageData
```js
{
  id: string,                     // Unique page identifier
  title: string,                  // Plain text title
  titleHtml?: string,             // Rich text HTML for title
  titleWidth?: number,            // Title element width
  elements: ElementData[],        // Array of page elements
  leftMargin?: number,            // Left margin in px (default 20)
  rightMargin?: number,           // Right margin in px (default 20)
  elementSpacing?: number,        // Vertical gap between elements in px (default 43)
  backgroundColor?: string,       // Content area background (default 'white')
}
```

### ElementData (Text)
```js
{
  id: string,
  type: 'text',
  order: number,                  // Sort order
  content: string,                // Plain text
  htmlContent: string,            // Rich text HTML
  width: number,                  // Element width in px
  borderColor: string,            // Border color
  borderWidth: number,            // Border width in px
  fillColor: string,              // Background fill
}
```

### ElementData (BidTable)
```js
{
  id: string,
  type: 'bidtable',
  order: number,
  rows: RowData[],                // See bid_table.md
  name: string,                   // Table name
  nameHtml?: string,              // Rich text name
  showName: boolean,              // Whether name row is visible
  width: number,                  // Table width in px
  columnWidths: number[],         // Non-bid column widths
  levelWidths: { [level]: number }, // Bid column width per nesting level
  gridlines: GridlineOptions,     // See bid_table.md
  borderColor: string,
  borderWidth: number,
  defaultRowHeight?: number,      // Minimum row height (20-60)
}
```

## Page Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialPage` | `PageData` | required | Page data to initialize from |
| `mode` | `string` | `'main'` | Page mode: `'main'`, `'split'`, `'popup'`, `'newpage'` |
| `onSave` | `(pageData) => void` | — | Main mode only. Called when user saves |
| `onClose` | `() => void` | — | Sub-page modes. Called when X is clicked |
| `onPageChange` | `(pageData) => void` | — | Called on every mutation (live sync to parent) |
| `availablePages` | `Array<{id, name}>` | `[]` | Pages available for hyperlink targets |
| `mainPageId` | `string` | — | ID of the main page (excluded from hyperlink targets) |
| `onHyperlinkClick` | `(target) => void` | — | Called when a hyperlink is clicked |
| `startInEditMode` | `boolean` | `false` | Main mode: start in edit mode instead of view |
| `maxHeight` | `string` | — | Popup mode: CSS max-height for content (e.g. `'70vh'`) |

### Hyperlink Click Target
```js
{
  pageId: string,       // Target page ID
  pageName: string,     // Display name (link text)
  mode: string,         // 'popup' | 'split' | 'newpage'
  position: { x, y },   // Click coordinates (for popup positioning)
}
```

### Linkable Pages Filtering
The Page component automatically filters `availablePages` before passing to child elements:
- Removes the current page (no self-linking)
- Removes the main page (`mainPageId`) — main page cannot be linked from anywhere

## PopupView Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `{x, y}` | required | Click coordinates to position near |
| `zIndex` | `number` | `100` | CSS z-index for stacking |
| `children` | `ReactNode` | required | Content (typically a `<Page mode="popup">`) |

### PopupView Behavior
- Positions slightly right of click point, vertically centered
- Adjusts to stay within viewport boundaries
- Draggable by the title bar (`data-popup-header` attribute)
- Stays in viewport on window resize
- Fades in after initial positioning (avoids flash)

## Page Layout

```
┌─────────────────────────────────────┐
│  Title                          [X] │  ← title row (X for sub-pages)
├─────────────────────────────────────┤  ← top line
│                                     │
│  [Element 1]                        │  ← content area
│                                     │     (scrollable if overflow)
│  [Element 2]                        │     left/right margins
│                                     │     element spacing between
│  [Element 3]                        │
│                                     │
├─────────────────────────────────────┤  ← bottom line
│  Insert  [Paste]         Save/Edit  │  ← bottom bar
└─────────────────────────────────────┘
```

## Dynamic Width
Page width tracks the widest element + left margin + right margin (minimum 300px). As elements are resized, the page expands/contracts automatically.

## Save / Discard (Main Mode)
- Clicking **Save** when dirty: shows a dialog with "Save changes" and "Discard changes"
- **Save**: calls `onSave(pageData)`, switches to view mode
- **Discard**: resets to `initialPage`, increments `resetKey` to force BidTable/TextEl remount
- Clicking **Save** when clean: switches to view mode (no dialog)

## Page Format Panel
Shown when content area **border** is clicked (within 8px edge) while in edit mode. Controls:
- **Left margin**: number input + presets (10, 20, 40, 60)
- **Right margin**: number input + presets (10, 20, 40, 60)
- **Element spacing**: number input + presets (20, 30, 43, 60)

## Element Operations

| Operation | Trigger |
|-----------|---------|
| Add element | Insert button → Table or Text |
| Delete element | Element format panel → trash icon |
| Copy element | Element format panel → copy icon (stored in sessionStorage) |
| Paste element | Paste button in bottom bar (appears when clipboard has data) |
| Move up/down | Element format panel → arrow buttons |
| Reorder | Move changes the `order` property |

## Integration Pattern

```jsx
import { Page, PopupView } from 'bsd-lib';

function App() {
  const [page, setPage] = useState(myPageData);
  const [popup, setPopup] = useState(null);

  return (
    <>
      <Page
        initialPage={page}
        mode="main"
        onSave={setPage}
        mainPageId={page.id}
        availablePages={allPages}
        onHyperlinkClick={(target) => {
          if (target.mode === 'popup') {
            setPopup({ position: target.position, page: lookupPage(target.pageId) });
          }
        }}
      />

      {popup && (
        <PopupView position={popup.position}>
          <Page
            initialPage={popup.page}
            mode="popup"
            maxHeight="70vh"
            mainPageId={page.id}
            onClose={() => setPopup(null)}
            availablePages={allPages}
          />
        </PopupView>
      )}
    </>
  );
}
```

## Dependencies
- `react` (useState, useCallback, useEffect, useRef, useMemo)
- `lucide-react` (X icon for close button)
- `text_el` module (TitleBar uses TextEl)
- `bid_table` module (renders BidTable elements)
