/**
 * Generic badge/tag component.
 *
 * kind="tag"   -> small pill used in card-tags rows and article tag lists
 *                 (pass variant="leaf" | "ember" for the coloured outline styles)
 * kind="stage" -> the absolutely-positioned label in the top-left of a pod-media photo
 * kind="heat"  -> the absolutely-positioned SHU label in the top-right of a pod-media photo
 */
export default function Badge({ kind = 'tag', variant, children, style, className = '' }) {
  let base;
  if (kind === 'stage') base = 'stage-tag';
  else if (kind === 'heat') base = 'heat-badge';
  else base = 'tag' + (variant ? ` ${variant}` : '');

  const finalClassName = className ? `${base} ${className}` : base;
  return <span className={finalClassName} style={style}>{children}</span>;
}
