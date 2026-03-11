# BidTable Module

Hierarchical N-column table for bridge bidding system documents. Each row has a bid column (leftmost) and N user-defined columns. Rows can be nested to any depth. Column count is table-wide (every row has the same number of columns).

## Files

| File | Purpose |
|------|---------|
| `BidTable.jsx` | Main component. State management, row CRUD, column add/delete, copy/paste, undo, resize. |
| `BidTableRow.jsx` | Single row rendering. Bid cell + N column cells, action menu, column resize, merge groups, recursion for children. |
| `BidTableFormatPanel.jsx` | Element format panel shown when table is selected (border, gridlines, copy, delete, move). |
| `BidTableNameHeader.jsx` | Optional name/title row at top of table. Editable via TextEl cell mode. |
| `ColorPicker.jsx` | Fill color picker for bid cells (light pastels, accessed via corner indicator). |
| `types.js` | Type definitions (JSDoc), default row height constant. |
| `index.js` | Barrel exports. |

## Data Structures

### RowData
```js
{
  id: string,           // Unique identifier
  bid: string,          // Bid text (e.g. "1NT", "2C")
  bidHtml?: string,     // Rich text HTML for bid cell
  bidFillColor?: string, // Background color for bid cell
  columns: ColumnData[], // N non-bid columns (table-wide count)
  children: RowData[],  // Nested child rows
  collapsed?: boolean   // Whether children are hidden
}
```

### ColumnData
```js
{
  value: string,              // Plain text
  html?: string,              // Rich text HTML
  mergedWithPrevious?: boolean // If true, merges visually with left neighbor
}
```

### GridlineOptions
```js
{
  enabled: boolean,           // Show/hide internal gridlines
  color: string,              // Gridline color
  width: number,              // Gridline width in px
  style?: 'solid' | 'dashed' | 'dotted'
}
```

## Column Architecture

### Table-Wide Column Count
- Column count = `columnWidths.length`
- Adding/deleting a column affects ALL rows recursively (table-wide operation)
- Users can merge individual cells with their left neighbor (`mergedWithPrevious`) per-row

### Width Model
- **Extra columns** (index > 0): **fixed absolute width** from `columnWidths[i]`, same at every nesting level
- **Meaning column** (index 0): absorbs remaining space = `totalNonBidSpace - sum(extraColumnWidths)`
- This ensures extra column edges **align vertically** across all nesting levels
- Only the meaning column shrinks as nesting deepens (indent + bid absorb space)

### Width Calculation Per Row
```
totalNonBidSpace = tableWidth - indentWidth - bidColumnWidth
col[0] renderWidth = totalNonBidSpace - sum(columnWidths[1..N])
col[i] renderWidth = columnWidths[i]  (for i > 0)
```

### Nesting Layout
```
Level 0: [bid(0)] [meaning(0)............] [col2  ] [col3  ]
Level 1: [indent] [bid(1)] [meaning(1)..] [col2  ] [col3  ]
Level 2: [indent.......] [bid(2)] [m(2)] [col2  ] [col3  ]
```
- `indent = sum of all bid widths at levels < current`
- Bid width per level stored in `levelWidths` (adjustable per level via drag)
- Extra column edges stay aligned across all levels

### Resize Behavior
- **Bid column right edge**: column_resize between bid and meaning (updates `levelWidths[level]`)
- **Non-last column right edge**: column_resize between adjacent columns (updates `columnWidths`)
- **Table right edge** (outermost): table resize (updates total `width`, meaning column absorbs change)

## Merge (Per-Cell)

- `columns[i].mergedWithPrevious = true` merges column `i` with column `i-1` visually
- `columns[0].mergedWithPrevious = true` merges meaning column with bid column (bid hidden)
- Merge is per-row, not inherited by children or siblings
- Merged columns render as one visual cell (combined width, single TextEl)
- Column groups are built from contiguous merged columns

## Row Operations

All row operations are available via the action menu (hover bottom-right of any column):

| Button | Action | Scope |
|--------|--------|-------|
| `+↑` | Add row above | Sibling |
| `+↓` | Add row below | Sibling |
| `++` | Add child row | Child (one level deeper) |
| `-` | Add parent sibling | Parent level (only shown at level > 0) |
| `⇔` | Toggle merge with left | Per-cell column merge |
| `+\|` | Add column to right | Table-wide |
| `x\|` | Delete column | Table-wide (disabled when 1 column) |
| `Copy` | Copy row to clipboard | Stores in sessionStorage |
| `Paste` | Paste row below | Validates column count match |
| `x` | Delete row | With undo support (60s timeout) |

### Keyboard Shortcuts
- `+` : Add sibling row below (when hovered, not editing)
- `Shift++` : Add child row
- `-` : Add parent sibling (level > 0)
- `x` / `X` : Delete row
- `Ctrl/Cmd+Z` : Undo delete
- `Ctrl/Cmd+Shift+C` : Copy focused row
- `Ctrl/Cmd+Shift+V` : Paste below focused row

## Copy/Paste

- Stored in `sessionStorage` as `{ row: RowData, columnCount: number }`
- Paste validates: `copiedColumnCount === currentColumnCount` (Paste button disabled on mismatch)
- If target row is blank, paste replaces it; otherwise inserts below
- Pasted rows get new IDs (deep clone)
- `copyVersion` state counter forces re-render after copy so `canPaste` recomputes

## Collapse/Expand

- Rows with children show a blue triangle at bottom-right of bid cell
- Click triangle to toggle `collapsed` state
- When expanding, direct children that have their own children start collapsed (one-level-at-a-time reveal)
- Initial state: all rows start collapsed (`collapseAllRows` applied on init)

## Bid Cell Fill Color

- Corner indicator (top-right triangle) appears on hover in bid cell
- Click to select cell (blue highlight) and open ColorPicker
- ColorPicker rendered via `createPortal` to avoid clipping
- Colors: None, Light Blue/Green/Yellow/Orange/Pink/Purple/Gray

## BidTable Props

### Data Props
| Prop | Type | Description |
|------|------|-------------|
| `initialRows` | `RowData[]` | Initial row data. Supports legacy format (auto-migrated) |
| `initialColumnWidths` | `number[]` | Initial stored widths for non-bid columns (e.g. `[450, 130]`) |
| `initialLevelWidths` | `{[level]: width}` | Initial bid column widths per level (default `{0: 80}`) |
| `initialName` | `string` | Table name/title |
| `initialNameHtml` | `string` | HTML for table name |
| `initialShowName` | `boolean` | Whether to show name row (default `true`) |

### Controlled Props
| Prop | Type | Description |
|------|------|-------------|
| `width` | `number` | Table width in px (controlled by parent) |
| `maxWidth` | `number` | Maximum width for resize |
| `gridlines` | `GridlineOptions` | Internal cell gridline settings |
| `borderColor` | `string` | Outer table border color (default `'#d1d5db'`) |
| `borderWidth` | `number` | Outer table border width in px (default `1`) |
| `isSelected` | `boolean` | Element selected state. Shows format panel + blue ring |
| `isViewMode` | `boolean` | Read-only mode. Hides all editing UI |
| `isActive` | `boolean` | Whether resize handles are active (default `true`) |
| `availablePages` | `Array<{id, name}>` | Pages for hyperlink targets in cells |
| `defaultRowHeight` | `number` | Minimum row height |

### Callback Props
| Prop | Type | Description |
|------|------|-------------|
| `onRowsChange` | `(rows) => void` | Called when rows change (add/delete/edit/paste) |
| `onWidthChange` | `(width) => void` | Called after table resize |
| `onColumnWidthsChange` | `(widths) => void` | Called after column resize or add/delete |
| `onLevelWidthsChange` | `(widths) => void` | Called after bid column resize |
| `onNameChange` | `(name) => void` | Called when name text changes |
| `onNameHtmlChange` | `(html) => void` | Called when name HTML changes |
| `onShowNameChange` | `(show) => void` | Called when name row deleted |
| `onStyleChange` | `({borderColor?, borderWidth?}) => void` | Called when border changed via format panel |
| `onGridlinesChange` | `(gridlines) => void` | Called when gridlines changed via format panel |
| `onHyperlinkClick` | `(target) => void` | Called when hyperlink clicked in cells |
| `onSelect` | `() => void` | Called when table border clicked |
| `onFocus` | `() => void` | Called when any internal cell gains focus. Parent should deselect the element |
| `onCopy` | `() => void` | Copy element callback (page handles) |
| `onDelete` | `() => void` | Delete element callback (page handles) |
| `onMoveUp` | `() => void` | Move element up callback (page handles) |
| `onMoveDown` | `() => void` | Move element down callback (page handles) |
| `onDefaultRowHeightChange` | `(height) => void` | Row height change callback |

## Element Format Panel (BidTableFormatPanel)

Shown when `isSelected && !isViewMode`. Controls (left to right):

| Section | Controls |
|---------|----------|
| Border | Color picker, width selector (0-4px) |
| Gridlines | Toggle (on/off), color picker (when on), width selector (when on) |
| Actions | Copy (clipboard icon), Delete (red trash icon) |
| Move | Move up (^), Move down (v) |

## Selection Behavior
- Clicking table **border** (within 6px edge): selects table, shows format panel + blue ring
- Clicking **inside** any cell: deselects table (via `onFocus` callback), shows cell's Menu 2
- Clicking **outside** table: parent deselects (sets `isSelected=false`)
- `onFocus` fires when any cell (data cells or name header) gains focus. Parent should use this to deselect the element

## Legacy Data Migration

`migrateRowData(row, columnCount)` converts old format to new:
- Old: `{ meaning, meaningHtml, isMerged, ... }` (single meaning column)
- New: `{ columns: [{ value, html, mergedWithPrevious }], ... }` (N columns)
- Auto-pads/trims columns to match current `columnCount`

## Integration with Page Module

The page module owns element state and passes it to BidTable. Key callbacks:
- `onStyleChange` - page updates border state
- `onGridlinesChange` - page updates gridline state
- `onCopy` / `onDelete` - page handles element-level copy/delete
- `onMoveUp` / `onMoveDown` - page reorders elements
- `onFocus` - page deselects the element (and any other selected elements)
- `onSelect` - page marks element as selected
- `onWidthChange` - page stores new width
- `onRowsChange` - page stores row data

## Internal Components

### BidTableRow
Renders a single row and recurses for children. Receives all callbacks from BidTable and passes them through. Key internal state:
- `hoveredColumnIndex` - which column's action menu zone is hovered
- `isCellSelected` - whether bid cell is selected for fill color
- `showColorPicker` - ColorPicker visibility
- `isHovered` - row hover state for keyboard shortcuts

### BidTableNameHeader
Optional name row at top. Simple wrapper around a cell-mode TextEl with a hover-visible delete button. Accepts `onFocus` to participate in element deselection.

### ColorPicker
Bid cell fill color picker. 8 preset colors (None + 7 pastels). Rendered via portal.

## Dependencies
- `react`, `react-dom` (createPortal)
- `re-resizable` (table resize, bid column resize, column resize)
- `lucide-react` (icons: Undo, Copy, Trash2, ChevronUp, ChevronDown, Square, Grid3X3, X)
- `text_el` module (TextEl in cell mode for all editable cells)
