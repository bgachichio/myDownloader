import { Menu } from 'lucide-react';
import Mark from './Mark';

export default function Topbar({ title, onMenuOpen }) {
  return (
    <div className="topbar safe-top">
      <button
        onClick={onMenuOpen}
        className="rounded-xl flex-shrink-0 flex items-center justify-center"
        style={{ background: 'var(--c-surface-2)', minWidth: 44, minHeight: 44 }}
        aria-label="Open menu"
        aria-haspopup="dialog"
      >
        <Menu size={19} style={{ color: 'var(--c-ink2)' }} />
      </button>

      <div className="flex items-center gap-2 flex-1">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--c-brand)' }}>
          <Mark size={13} />
        </div>
        <span className="font-extrabold text-base" style={{ color: 'var(--c-ink)', letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--c-ink)' }}>my</span><span style={{ color: 'var(--c-brand-text)' }}>Downloader</span>
        </span>
      </div>

      {title && (
        <span className="text-sm font-semibold" style={{ color: 'var(--c-text2)' }}>{title}</span>
      )}
    </div>
  );
}
