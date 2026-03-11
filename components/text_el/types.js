/**
 * BSD Text Element Types
 *
 * Shared type definitions (documented via JSDoc for plain JS).
 */

/**
 * @typedef {'default' | 'cell'} TextElMode
 * - default: Full features (formatting, hyperlinks, resize, element styling, block format bar)
 * - cell: For BidTable cells (no resize, no element format, but hyperlinks allowed)
 */

/**
 * @typedef {'popup' | 'split' | 'newpage'} HyperlinkMode
 */

/**
 * @typedef {{ pageId: string, pageName: string, mode: HyperlinkMode, position?: { x: number, y: number } }} HyperlinkTarget
 */

/**
 * @typedef {{ bold?: boolean, italic?: boolean, underline?: boolean, strikethrough?: boolean, fontFamily?: string, fontSize?: string, color?: string, backgroundColor?: string, textAlign?: 'left' | 'center' | 'right' | 'justify', listType?: 'bullet' | 'number' | null }} TextFormat
 */

/**
 * @typedef {{ borderColor?: string, borderWidth?: number, fillColor?: string }} ElementStyle
 */

/**
 * Layout constants
 */
export const LAYOUT = {
  MYSPACE: 43,
  A4_WIDTH: 595,
  A4_HEIGHT: 842,
  DEFAULT_MARGIN: 20,
  MIN_ELEMENT_HEIGHT: 34,
};

/**
 * Mode-specific feature flags
 */
export const MODE_FEATURES = {
  default: { allowHyperlinks: true, allowBullets: true, allowResize: true },
  cell:    { allowHyperlinks: true, allowBullets: true, allowResize: false },
};
