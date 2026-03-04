import { useState } from 'react';
import { Download, Home, Settings, History, Coffee, Menu, X, Zap } from 'lucide-react';

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
  if (!open) return null;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4" style={{ borderBottom: '1px solid #e8f0eb' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center pulse-glow-anim" style={{ background: '#237352' }}>
              <Zap size={17} color="white" fill="white" />
            </div>
            <div>
              <div className="text-base leading-tight" style={{ fontWeight: 800, color: '#0f1923' }}>
                <span style={{ color: '#0f1923' }}>my</span><span style={{ color: '#237352' }}>Downloader</span>
              </div>
              <div className="text-xs" style={{ color: '#94a3b8', fontWeight: 500 }}>Fast · Safe · Free</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: '#f1f5f9' }}>
            <X size={17} style={{ color: '#64748b' }} />
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
                background: activePage === id ? '#237352' : 'transparent',
                color: activePage === id ? 'white' : '#4a5568',
              }}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 pt-0">
          <a
            href="https://paystack.shop/pay/gachichio"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold mb-3"
            style={{ background: '#e8f5ee', color: '#237352' }}
          >
            <Coffee size={15} /> Buy me a coffee ☕
          </a>
          <p className="text-center text-xs" style={{ color: '#b0bec5' }}>
            Made with ❤️ by <span style={{ color: '#237352', fontWeight: 600 }}>Brian Gachichio</span>
          </p>
        </div>
      </aside>
    </>
  );
}
