import { TextEl } from '../text_el';

/**
 * TitleBar - Editable title at top of page.
 * Uses TextEl in default mode with transparent border/fill.
 */
export function TitleBar({
  title,
  titleHtml,
  onChange,
  readOnly = false,
  isSelected = false,
  onSelect,
  onFocus,
  width,
  maxWidth,
  onWidthChange,
  paddingLeft = 20,
  paddingRight = 20,
}) {
  return (
    <div style={{
      marginTop: '14px',
      paddingBottom: '6px',
      paddingLeft: `${paddingLeft}px`,
      paddingRight: `${paddingRight}px`,
      background: 'white',
      flexShrink: 0,
      fontSize: '18px',
      fontWeight: 700,
      textAlign: 'center',
    }}>
      <TextEl
        mode="default"
        value={title}
        htmlValue={titleHtml}
        onChange={(text, html) => onChange?.(text, html)}
        onFocus={onFocus}
        placeholder="Untitled"
        readOnly={readOnly}
        borderColor="transparent"
        borderWidth={0}
        fillColor="transparent"
        isSelected={isSelected}
        onSelect={onSelect}
        width={width}
        maxWidth={maxWidth}
        onWidthChange={onWidthChange}
      />
    </div>
  );
}
