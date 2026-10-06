import { Coffee, Heart } from 'lucide-react';
import { useApp } from '../hooks/app-context.js';
import { SUPPORT } from '../config/support';

// Standard footer shown on most pages
export default function Footer() {
  const { setSupportOpen } = useApp();
  return (
    <footer className="w-full py-4 px-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm"
      style={{ borderTop: '1px solid var(--c-line)', background: 'var(--c-surface)' }}>
      <span className="flex items-center gap-1.5" style={{ color: 'var(--c-text2)', fontSize: '0.8125rem' }}>
        Made with <Heart size={12} fill="var(--c-danger)" stroke="none" /> by{' '}
        <a href={SUPPORT.authorUrl} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--c-brand-text)', fontWeight: 600 }}>{SUPPORT.authorName}</a>
      </span>
      <button type="button" onClick={() => setSupportOpen(true)}
        style={{ minHeight: 44, padding: '0 16px', borderRadius: 9999, fontSize: '0.8125rem', fontWeight: 600,
          background: 'var(--c-tint)', color: 'var(--c-brand-text)', border: 'none', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Coffee size={14} /> ☕ Support
      </button>
    </footer>
  );
}

// Highlighted footer shown on download success screen
export function FooterHighlighted() {
  const { setSupportOpen } = useApp();
  return (
    <div className="mx-4 mb-4 rounded-2xl p-5 text-center"
      style={{ background: 'linear-gradient(135deg,var(--c-brand),var(--c-brand-2))', color: 'white' }}>
      <p className="text-sm font-medium opacity-90 mb-1">Enjoying myDownloader?</p>
      <p className="text-xs opacity-75 mb-4">
        Made with ❤️ by <strong>{SUPPORT.authorName}</strong>
      </p>
      <button type="button" onClick={() => setSupportOpen(true)}
        className="inline-flex items-center gap-2 px-5 rounded-full text-sm font-bold"
        style={{ minHeight: 44, background: 'var(--c-surface)', color: 'var(--c-brand-text)', border: 'none', cursor: 'pointer' }}>
        <Coffee size={15} /> ☕ Support
      </button>
    </div>
  );
}
