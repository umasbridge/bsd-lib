# TextEl Module

Rich text component with two modes, used as both a standalone page element and as the editing surface inside BidTable cells.

## Files

| File | Purpose |
|------|---------|
| `TextEl.jsx` | Main component. Two modes: `default` (full features) and `cell` (for BidTable cells). |
| `useRichText.js` | Hook managing contentEditable state, selection tracking, formatting commands, hyperlink handling. |
| `TextFormatPanel.jsx` | Menu 1: floating panel on text selection (bold, italic, color, hyperlink). |
| `BlockFormatBar.jsx` | Menu 2: bar when cursor inside, no selection (alignment, bullet/numbered lists). |
| `ElementFormatPanel.jsx` | Menu 3: bar when element border clicked (border color/width, fill, copy, delete, move up/down). |
| `HyperlinkMenu.jsx` | Dropdown for creating/editing internal page hyperlinks. |
| `types.js` | Type definitions (JSDoc), layout constants, mode feature flags. |
| `index.js` | Barrel exports. |

## Modes

### Default Mode
Full standalone element on a page. Features:
- Resizable width (via `re-resizable`, right edge)
- Border color, border width, fill color (controlled by parent)
- Three mutually exclusive context menus (see below)
- Element selection via border click (blue ring + Menu 3)
- Page-level callbacks: `onMoveUp`, `onMoveDown`, `onCopy`, `onDelete`

### Cell Mode
Used inside BidTable cells. Features:
- No resize, no element border/fill, no Menu 3
- Menu 1 (text format) and Menu 2 (block format) only
- Menu 2 renders via `createPortal` to `document.body` to avoid clipping in narrow cells
- Positioned with `useLayoutEffect` at cell's top-left, translated up

## Context Menus (Mutually Exclusive)

Priority order when determining which menu to show:

1. **Menu 3 (ElementFormatPanel)** - `isSelected && !readOnly`
   - Shown when element border is clicked (default mode only)
   - Controls: border color picker, border width selector, fill color picker, copy, delete, move up/down
   - Rendered inside the element wrapper, above content

2. **Menu 2 (BlockFormatBar)** - `isFocused && !showHyperlinkMenu && !isSelected && !selection.hasSelection`
   - Shown when cursor is inside, no text selected, element not selected
   - Controls: left/center/right align, bullet list, numbered list
   - Default mode: rendered inside wrapper. Cell mode: rendered via portal above cell

3. **Menu 1 (TextFormatPanel)** - `showFormatPanel && !showHyperlinkMenu && selection.hasSelection && !isSelected`
   - Shown when text is selected
   - Controls: bold, italic, text color, hyperlink (add/remove)
   - Floating, positioned relative to selection

4. **HyperlinkMenu** - shown when creating a hyperlink from Menu 1
   - Lists available pages, user selects target page and link mode (popup/split/newpage)

## Props

### Common Props (both modes)
| Prop | Type | Description |
|------|------|-------------|
| `mode` | `'default' \| 'cell'` | Rendering mode |
| `value` | `string` | Plain text value |
| `htmlValue` | `string` | HTML content (takes precedence for rendering) |
| `onChange` | `(text, html) => void` | Called on content change |
| `readOnly` | `boolean` | Disables editing. Hyperlinks still clickable |
| `placeholder` | `string` | Placeholder text when empty |
| `minHeight` | `number` | Minimum height in px |
| `onFocus` | `() => void` | Called when contenteditable gains focus |
| `onBlur` | `() => void` | Called when contenteditable loses focus |
| `availablePages` | `Array<{id, name}>` | Pages available for hyperlink targets |
| `onHyperlinkClick` | `(target) => void` | Called when a hyperlink is clicked in read-only or view mode |
| `className` | `string` | Additional CSS classes |

### Default Mode Props
| Prop | Type | Description |
|------|------|-------------|
| `width` | `number` | Element width in px (controlled by parent) |
| `maxWidth` | `number` | Maximum width for resize |
| `onWidthChange` | `(width) => void` | Called after resize |
| `isSelected` | `boolean` | Element selected state (border clicked). Shows Menu 3 + blue ring |
| `onSelect` | `() => void` | Called when border is clicked |
| `borderColor` | `string` | Border color (default `'#d1d5db'`) |
| `borderWidth` | `number` | Border width in px (default `2`) |
| `fillColor` | `string` | Background fill (default `'transparent'`) |
| `onStyleChange` | `({borderColor?, borderWidth?, fillColor?}) => void` | Called when style changed via Menu 3 |
| `onCopy` | `() => void` | Copy element callback (page handles) |
| `onDelete` | `() => void` | Delete element callback (page handles) |
| `onMoveUp` | `() => void` | Move element up callback (page handles) |
| `onMoveDown` | `() => void` | Move element down callback (page handles) |

## Selection Behavior
- Clicking the element **border** (within 10px edge): selects element, shows Menu 3, blurs text
- Clicking **inside** text area: focuses text, dismisses Menu 3 (via `onFocus` callback)
- Clicking **outside** element: parent deselects (sets `isSelected=false`)
- `onFocus` fires when the contenteditable gains focus. Parent should use this to deselect the element and dismiss any other selected elements

## Hyperlink Format
Hyperlinks are stored as `<a>` tags with data attributes:
```html
<a href="bridge://page-id/mode"
   data-page-id="page-1"
   data-link-mode="popup"
   style="color: #2563eb; text-decoration: underline; cursor: pointer">
  Link text
</a>
```

## Integration with Page Module
The page module owns element state and passes it to TextEl. Key callbacks:
- `onStyleChange` - page updates border/fill state
- `onCopy` / `onDelete` - page handles element-level copy/delete
- `onMoveUp` / `onMoveDown` - page reorders elements
- `onFocus` - page deselects the element (and any other selected elements)
- `onSelect` - page marks element as selected
- `onWidthChange` - page stores new width
- `onChange` - page stores text/html content

## Dependencies
- `react`, `react-dom` (createPortal)
- `re-resizable` (width resize in default mode)
- `lucide-react` (icons: PaintBucket, Square, Copy, Trash2, ChevronDown, ChevronUp, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Bold, Italic, Link, Unlink, Palette)
