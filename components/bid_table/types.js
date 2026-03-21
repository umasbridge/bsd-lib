/**
 * BidTable Type Definitions (JSDoc)
 *
 * @typedef {{ value: string, html?: string, mergedWithPrevious?: boolean }} ColumnData
 *
 * @typedef {{ id: string, bid: string, bidHtml?: string, bidFillColor?: string, columns: ColumnData[], children: RowData[], collapsed?: boolean }} RowData
 *
 * @typedef {{ enabled: boolean, color: string, width: number, style?: 'solid' | 'dashed' | 'dotted' }} GridlineOptions
 */

export const DEFAULT_ROW_MIN_HEIGHT = 20;
