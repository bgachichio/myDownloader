import { Menu, Zap } from 'lucide-react';

export default function Topbar({ title, onMenuOpen }) {
  return (
    <div className="topbar safe-top">
      <button
        onClick={onMenuOpen}
        className="p-2 rounded-xl flex-shrink-0"
        style={{ background: '#f1f5f9' }}
        aria-label="Open menu"
      >
        <Menu size={19} style={{ color: '#374151' }} />
      </button>

      <div className="flex items-center gap-2 flex-1">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: '#237352' }}>
          <Zap size={14} color="white" fill="white" />
        </div>
        <span className="font-extrabold text-base" style={{ color: '#0f1923', letterSpacing: '-0.02em' }}>
          <span style={{ color: '#0f1923' }}>my</span><span style={{ color: '#237352' }}>Downloader</span>
        </span>
      </div>

      {title && (
        <span className="text-sm font-semibold" style={{ color: '#64748b' }}>{title}</span>
      )}
    </div>
  );
}
