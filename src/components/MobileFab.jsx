import { useApp } from '../context/AppContext.jsx';

export default function MobileFab() {
  const { openWizard } = useApp();
  return (
    <button className="mobile-fab" aria-label="Начать дневник" onClick={openWizard}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
    </button>
  );
}
