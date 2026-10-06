import { useEffect, useRef, useState } from 'react';
import { Coffee, Copy, Check, X, ExternalLink } from 'lucide-react';
import { SUPPORT } from '../config/support';
import { useApp } from '../hooks/app-context.js';

// Bottom sheet with three ways to help. Opens only on a tap; no payment script runs here,
// and nothing leaves the app until the visitor taps a link (designer 12.4, builder 6.1).
function Option({ title, subtitle, children }) {
  return (
    <div className="p-4" style={{ background: 'var(--c-surface-2)', borderRadius: 20 }}>
      <p className="font-bold" style={{ color: 'var(--c-ink)', fontSize: '0.9375rem' }}>{title}</p>
      <p style={{ color: 'var(--c-text2)', fontSize: '0.8125rem', marginBottom: 12 }}>{subtitle}</p>
      {children}
    </div>
  );
}

const pill = {
  minHeight: 44, padding: '0 16px', borderRadius: 9999, fontWeight: 600, fontSize: '0.875rem',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap',
  border: '1px solid var(--c-brand-text)', color: 'var(--c-brand-text)', background: 'transparent',
  cursor: 'pointer', textDecoration: 'none',
};
const well = {
  background: 'var(--c-line)', borderRadius: 12, padding: '10px 12px', marginBottom: 12,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.8125rem',
  wordBreak: 'break-all', color: 'var(--c-ink)',
};

function CopyButton({ value, label }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* clipboard blocked */ }
  };
  return (
    <button type="button" onClick={copy} style={pill} aria-label={`Copy ${label}`}>
      {done ? <Check size={16} /> : <Copy size={16} />} {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function SupportSheet() {
  const { supportOpen, setSupportOpen } = useApp();
  const closeRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    if (!supportOpen) return undefined;
    openerRef.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') setSupportOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openerRef.current?.focus?.();
    };
  }, [supportOpen, setSupportOpen]);

  if (!supportOpen) return null;
  const close = () => setSupportOpen(false);

  return (
    <>
      <div className="drawer-overlay" style={{ zIndex: 60 }} onClick={close} />
      <div role="dialog" aria-modal="true" aria-label="Support myDownloader"
        className="slide-up"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 70, maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--c-surface)', borderRadius: '28px 28px 0 0', padding: '12px 20px calc(20px + env(safe-area-inset-bottom))',
          maxWidth: 560, margin: '0 auto',
        }}>
        <div style={{ width: 32, height: 4, borderRadius: 2, background: 'var(--c-line)', margin: '0 auto 12px' }} />
        <div className="flex items-start justify-between gap-3" style={{ marginBottom: 8 }}>
          <div>
            <h2 className="font-extrabold" style={{ color: 'var(--c-ink)', fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
              <Coffee size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: '-3px' }} />Support myDownloader
            </h2>
            <p style={{ color: 'var(--c-text2)', fontSize: '0.875rem', marginTop: 4 }}>
              myDownloader is free and has no ads. If it saved you time, you can help keep it that way.
              Payments leave myDownloader only when you tap.
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={close} aria-label="Close"
            style={{ ...pill, width: 44, padding: 0, border: 'none', background: 'var(--c-surface-2)', color: 'var(--c-ink)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3" style={{ marginTop: 12 }}>
          <Option title="Card or M-Pesa" subtitle="Opens Paystack in a new tab">
            <a href={SUPPORT.paystackUrl} target="_blank" rel="noopener noreferrer" style={pill}>
              Open Paystack <ExternalLink size={16} />
            </a>
          </Option>
          <Option title="Bitcoin, Lightning" subtitle="Instant, near-zero fees">
            <div style={well}>{SUPPORT.lightning}</div>
            <div className="flex gap-2 flex-wrap">
              <CopyButton value={SUPPORT.lightning} label="Lightning address" />
              <a href={`lightning:${SUPPORT.lightning}`} style={pill}>Open wallet</a>
            </div>
          </Option>
          <Option title="Bitcoin, on-chain" subtitle="Taproot address, any Bitcoin wallet">
            <div style={well}>{SUPPORT.onchain}</div>
            <div className="flex gap-2 flex-wrap">
              <CopyButton value={SUPPORT.onchain} label="Bitcoin address" />
              <a href={`bitcoin:${SUPPORT.onchain}`} style={pill}>Open wallet</a>
            </div>
          </Option>
        </div>
      </div>
    </>
  );
}
