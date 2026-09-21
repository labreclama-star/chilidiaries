/**
 * Reusable filter-bar shell: renders whatever filter controls are passed as
 * children (selects, chips, search box, ...) on the left, with an optional
 * results counter pinned to the right via the existing .filter-spacer rule.
 */
export default function FilterBar({ children, resultsLabel }) {
  return (
    <div className="filter-bar">
      {children}
      <div className="filter-spacer" />
      {resultsLabel != null && <span className="results-count">{resultsLabel}</span>}
    </div>
  );
}

/** A single toggle chip for chip-style filters (species, category, etc). */
export function FilterChip({ active, onClick, children }) {
  return (
    <button className={'chip' + (active ? ' active' : '')} onClick={onClick} type="button">
      {children}
    </button>
  );
}
