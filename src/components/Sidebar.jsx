import { Download, Home, Settings, History, Coffee, Menu, X } from 'lucide-react';
import Mark from './Mark';
import { useApp } from '../hooks/app-context.js';
import { SUPPORT } from '../config/support';

const navItems = [
  { icon: Home,     label: 'Home',       id: 'home' },
  { icon: Download, label: 'Downloader', id: 'downloader' },
  { icon: History,  label: 'History',    id: 'history' },
  { icon: Settings, label: 'Settings',   id: 'settings' },
];

// ── Bottom navigation bar (mobile) ──────────────────────────────────────────
export function BottomNav({ activePage, onNavigate }) {
  return (
    <nav className="bottom-nav">
      {navItems.map(({ icon: Icon, label, id }) => (
        <button
          key={id}
          onClick={() => onNavigate(id)}
          className={`bottom-nav-item ${activePage === id ? 'active' : ''}`}
        >
          <Icon size={activePage === id ? 22 : 20} strokeWidth={activePage === id ? 2.5 : 1.8} />
          {label}
          {activePage === id && <span className="nav-dot" />}
        </button>
      ))}
    </nav>
  );
}

// ── Hamburger drawer (desktop / tablet) ─────────────────────────────────────
export default function Sidebar({ activePage, onNavigate, open, onClose }) {
  const { setSupportOpen } = useApp();
  if (!open) return null;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4" style={{ borderBottom: '1px solid var(--c-line)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center pulse-glow-anim" style={{ background: 'var(--c-brand)' }}>
              <Mark size={16} />
            </div>
            <div>
              <div className="text-base leading-tight" style={{ fontWeight: 800, color: 'var(--c-ink)' }}>
                <span style={{ color: 'var(--c-ink)' }}>my</span><span style={{ color: 'var(--c-brand-text)' }}>Downloader</span>
              </div>
              <div className="text-xs" style={{ color: 'var(--c-text3)', fontWeight: 500 }}>Fast · Safe · Free</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close menu" className="rounded-lg flex items-center justify-center"
            style={{ background: 'var(--c-surface-2)', minWidth: 44, minHeight: 44 }}>
            <X size={17} style={{ color: 'var(--c-text2)' }} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-1 p-4">
          {navItems.map(({ icon: Icon, label, id }) => (
            <button
              key={id}
              onClick={() => { onNavigate(id); onClose(); }}
              className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: activePage === id ? 'var(--c-brand)' : 'transparent',
                color: activePage === id ? 'white' : 'var(--c-text2)',
              }}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 pt-0">
          <button type="button" onClick={() => { onClose(); setSupportOpen(true); }}
            className="flex items-center gap-2 w-full px-4 rounded-full text-sm font-semibold mb-3"
            style={{ minHeight: 44, background: 'var(--c-tint)', color: 'var(--c-brand-text)', border: 'none', cursor: 'pointer' }}
          >
            <Coffee size={15} /> ☕ Support
          </button>
          <p className="text-center text-xs" style={{ color: 'var(--c-faint)' }}>
            Made with ❤️ by <a href={SUPPORT.authorUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--c-brand-text)', fontWeight: 600 }}>{SUPPORT.authorName}</a>
          </p>
        </div>
      </aside>
    </>
  );
}
