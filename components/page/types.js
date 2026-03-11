/**
 * @typedef {Object} PageData
 * @property {string} id
 * @property {string} title
 * @property {string} [titleHtml]
 * @property {number} [titleWidth]
 * @property {ElementData[]} elements
 * @property {number} [leftMargin]
 * @property {number} [rightMargin]
 * @property {number} [elementSpacing]
 * @property {string} [backgroundColor]
 */

/**
 * @typedef {TextElementData | BidTableElementData} ElementData
 */

/**
 * @typedef {Object} TextElementData
 * @property {string} id
 * @property {'text'} type
 * @property {number} order
 * @property {string} content
 * @property {string} [htmlContent]
 * @property {number} [width]
 * @property {string} [borderColor]
 * @property {number} [borderWidth]
 * @property {string} [fillColor]
 */

/**
 * @typedef {Object} BidTableElementData
 * @property {string} id
 * @property {'bidtable'} type
 * @property {number} order
 * @property {import('../bid_table/types').RowData[]} rows
 * @property {string} [name]
 * @property {string} [nameHtml]
 * @property {boolean} [showName]
 * @property {number} [width]
 * @property {number[]} [columnWidths]
 * @property {Object<number, number>} [levelWidths]
 * @property {import('../bid_table/types').GridlineOptions} [gridlines]
 * @property {string} [borderColor]
 * @property {number} [borderWidth]
 * @property {number} [defaultRowHeight]
 */

export const DEFAULT_LEFT_MARGIN = 20;
export const DEFAULT_RIGHT_MARGIN = 20;
export const DEFAULT_ELEMENT_SPACING = 43;
export const MIN_PAGE_WIDTH = 300;
export const MAX_ELEMENT_WIDTH = 1200;
