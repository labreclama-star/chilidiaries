// Shared navigation icons — one per section, semantically matched
// (house for Home, trophy for Contests/Leaderboard, etc), consistent
// stroke-line style so the icon rail reads as one coherent set.

const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function IconHome(props) {
  return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9a1 1 0 0 0 1 1H17.5a1 1 0 0 0 1-1v-9" /></svg>;
}
export function IconBook(props) {
  return <svg viewBox="0 0 24 24" {...common} {...props}><rect x="4" y="3.5" width="16" height="17" rx="2.5" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
}
export function IconBookmark(props) {
  return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" /></svg>;
}
export function IconUsers(props) {
  return <svg viewBox="0 0 24 24" {...common} {...props}><circle cx="9" cy="8" r="3.2" /><path d="M2.8 19c0-3.4 2.8-5.5 6.2-5.5s6.2 2.1 6.2 5.5" /><circle cx="17" cy="8.5" r="2.4" /><path d="M15.5 13.7c2.6.3 4.7 2.2 4.7 5.3" /></svg>;
}
export function IconTrophy(props) {
  return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5" /></svg>;
}
export function IconPepper(props) {
  return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M9 4c1 1.6.4 2.8-.4 4C6.8 10 5.5 12.6 6.2 15c.8 2.8 3.6 4 6 3.2 2.8-1 4.8-3.6 4.8-6.8C17 8 15 5.6 12 4.6" /></svg>;
}
export function IconChefHat(props) {
  return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M6.5 10.5A3.5 3.5 0 0 1 8 4a3 3 0 0 1 4-1.6A3 3 0 0 1 16 4a3.5 3.5 0 0 1 1.5 6.5" /><path d="M6.5 10.5h11V19a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-8.5Z" /><path d="M6.5 15h11" /></svg>;
}
export function IconNewspaper(props) {
  return <svg viewBox="0 0 24 24" {...common} {...props}><rect x="3" y="5" width="14" height="15" rx="1.5" /><path d="M7 9h6M7 12.5h6M7 16h4" /><path d="M17 8h2.5A1.5 1.5 0 0 1 21 9.5V18a2 2 0 0 1-2 2h-2" /></svg>;
}
export function IconBulb(props) {
  return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" /></svg>;
}
export function IconDroplet(props) {
  return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M12 3s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11Z" /></svg>;
}
export function IconInfo(props) {
  return <svg viewBox="0 0 24 24" {...common} {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.1" /></svg>;
}
export function IconFeed(props) {
  return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M4 4v3a13 13 0 0 1 13 13h3C20 11.9 12.1 4 4 4Z" /><path d="M4 11v3a6 6 0 0 1 6 6h3a9 9 0 0 0-9-9Z" /><circle cx="6" cy="18" r="1.6" /></svg>;
}
export function IconQuestion(props) {
  return <svg viewBox="0 0 24 24" {...common} {...props}><circle cx="12" cy="12" r="9" /><path d="M9.3 9.3a2.7 2.7 0 1 1 3.9 2.4c-.8.5-1.2 1-1.2 2" /><path d="M12 16.8v.1" /></svg>;
}
export function IconSeed(props) {
  return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M6 9c0-3.3 2.7-6 6-6 0 3.3-2.7 6-6 6Z" /><path d="M12 3c0 8-4 10-7 10-.5-4 1.5-8 7-10Z" /><path d="M9 21c-3 0-4-2-4-5 0-4 3-6 7-6-1 5-1 11-3 11Z" /></svg>;
}
export function IconMore(props) {
  return <svg viewBox="0 0 24 24" {...common} {...props} fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>;
}
