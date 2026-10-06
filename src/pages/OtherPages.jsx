import { useState, useRef } from 'react';
import { useApp, THEMES, SCALES } from '../hooks/app-context.js';
import { SUPPORT } from '../config/support';
import pkg from '../../package.json';
import {
  Download, Link2, Loader2, AlertCircle, CheckCircle2,
  X, Trash2, ExternalLink, Clock, Settings2, ChevronDown, Share2
} from 'lucide-react';
import Footer, { FooterHighlighted } from '../components/Footer';
import { fetchMedia, downloadFile, isSupportedUrl, extractTweetId } from '../lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
function Banner({ type, message, onClose }) {
  const cfg = {
    error:   { bg: 'var(--c-danger-bg)', border: 'var(--c-danger-line)', color: 'var(--c-danger)', icon: AlertCircle },
    success: { bg: 'var(--c-ok-bg)', border: 'var(--c-ok-line)', color: 'var(--c-ok)', icon: CheckCircle2 },
    info:    { bg: 'var(--c-info-bg)', border: 'var(--c-info-line)', color: 'var(--c-info)', icon: AlertCircle },
  }[type] || { bg: 'var(--c-info-bg)', border: 'var(--c-info-line)', color: 'var(--c-info)', icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl mb-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <Icon size={15} style={{ color: cfg.color, marginTop: 1, flexShrink: 0 }} />
      <p className="text-sm flex-1 leading-snug" style={{ color: cfg.color }}>{message}</p>
      {onClose && <button onClick={onClose}><X size={13} style={{ color: cfg.color }} /></button>}
    </div>
  );
}

function ProgressBar({ pct }) {
  return (
    <div className="w-full rounded-full overflow-hidden mb-2" style={{ height: 6, background: 'var(--c-line)' }}>
      <div className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, background: 'linear-gradient(90deg,var(--c-brand),var(--c-brand-2))' }} />
    </div>
  );
}

// ── Quality badge ─────────────────────────────────────────────────────────────
function QualityBadge({ quality, selected, onClick }) {
  return (
    <button onClick={onClick}
      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
      style={{
        background: selected ? 'var(--c-brand)' : 'var(--c-bg)',
        color:      selected ? 'white'   : 'var(--c-text2)',
        border:     `2px solid ${selected ? 'var(--c-brand)' : 'var(--c-line)'}`,
      }}>
      {quality}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOWNLOADER PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function DownloaderPage({ sharedUrl, setSharedUrl }) {
  const [url,        setUrl]        = useState(sharedUrl || '');
  const [phase,      setPhase]      = useState('idle');   // idle | fetching | ready | downloading | done
  const [videoInfo,  setVideoInfo]  = useState(null);     // { variants, authorName, authorHandle, thumbnailUrl, tweetText }
  const [selectedQ,  setSelectedQ]  = useState(0);        // index into variants
  const [progress,   setProgress]   = useState(0);
  const [banner,     setBanner]     = useState(null);
  const inputRef = useRef(null);

  const reset = () => {
    setUrl(''); setPhase('idle'); setVideoInfo(null);
    setSelectedQ(0); setProgress(0); setBanner(null);
    setSharedUrl?.('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Step 1: Fetch video info ──────────────────────────────────────────────
  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) { inputRef.current?.focus(); return; }

    if (!isSupportedUrl(trimmed)) {
      setBanner({ type: 'error', message: 'Paste a post link from X or TikTok — e.g. x.com/…/status/… or tiktok.com/@user/video/…' });
      return;
    }

    setPhase('fetching');
    setBanner(null);
    setVideoInfo(null);

    try {
      const info = await fetchMedia(trimmed);
      setVideoInfo(info);
      setSelectedQ(0);
      setPhase('ready');
    } catch (err) {
      setBanner({ type: 'error', message: err.message });
      setPhase('idle');
    }
  };

  // ── Step 2: Download chosen quality ──────────────────────────────────────
  const handleDownload = async () => {
    const variant = videoInfo.variants[selectedQ];
    const handle   = (videoInfo.authorHandle || 'video').replace(/[^a-zA-Z0-9_]/g, '');
    const id       = videoInfo.mediaId || extractTweetId(url) || 'video';
    const qLabel   = variant.quality.replace(/[^a-zA-Z0-9]/g, '');
    const filename = `${handle}_${id}_${qLabel}.${variant.ext || 'mp4'}`;

    setPhase('downloading');
    setProgress(0);
    setBanner(null);

    try {
      const result = await downloadFile(variant.downloadUrl, filename, setProgress);

      if (result.method === 'tab') {
        setBanner({ type: 'info', message: 'iOS: long-press the video → "Save to Photos" or "Download Linked File".' });
        setPhase('ready');
        return;
      }

      // Save to history
      try {
        const hist = JSON.parse(localStorage.getItem('myd_history') || '[]');
        hist.unshift({
          url, title: `@${handle} · ${variant.quality}`, provider: videoInfo.provider,
          quality: variant.quality, date: Date.now(), filename,
        });
        localStorage.setItem('myd_history', JSON.stringify(hist.slice(0, 50)));
      } catch { /* storage full — ignore */ }

      window.tally?.click('downloaded'); // a completed download is the customer action Tally counts; the link and file name are never sent
      setPhase('done');
    } catch (err) {
      setBanner({ type: 'error', message: err.message });
      setPhase('ready');
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (phase === 'done') {
    const variant = videoInfo?.variants[selectedQ];
    return (
      <div className="flex flex-col min-h-full">
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-12 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{ background: 'linear-gradient(135deg,var(--c-brand),var(--c-brand-2))', boxShadow: '0 12px 32px rgba(35,115,82,0.35)' }}>
            <CheckCircle2 size={38} color="white" />
          </div>
          <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--c-ink)', letterSpacing: '-0.02em' }}>
            Saved!
          </h2>
          <p className="text-sm mb-1" style={{ color: 'var(--c-text2)' }}>
            🎬 {variant?.quality} · @{videoInfo?.authorHandle}
          </p>
          <p className="text-xs mb-8" style={{ color: 'var(--c-text3)' }}>Check your Downloads folder</p>
          <button onClick={reset} className="btn-primary w-full max-w-xs">
            <Download size={16} /> Download another
          </button>
        </div>
        <FooterHighlighted />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-2">
        <h1 className="text-xl font-black mb-0.5" style={{ color: 'var(--c-ink)', letterSpacing: '-0.02em' }}>
          Video Downloader
        </h1>
        <p className="text-xs" style={{ color: 'var(--c-text3)' }}>Paste an X or TikTok link · pick quality · download</p>
      </div>

      <div className="px-4 py-3 flex flex-col gap-3">
        {banner && <Banner type={banner.type} message={banner.message} onClose={() => setBanner(null)} />}

        <div className="card p-4">
          {/* URL input */}
          <label className="block text-xs font-black uppercase tracking-wider mb-2" style={{ color: 'var(--c-brand-text)' }}>
            X Post URL
          </label>
          <div className="relative mb-4">
            <Link2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-faint)' }} />
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setVideoInfo(null); setPhase('idle'); setBanner(null); setSharedUrl?.(e.target.value); }}
              onKeyDown={e => e.key === 'Enter' && phase === 'idle' && handleFetch()}
              placeholder="x.com · tiktok.com"
              className="url-input"
              style={{ paddingLeft: '38px', fontSize: '0.875rem' }}
            />
          </div>

          {/* ── Video info card (shown after fetch) ── */}
          {videoInfo && phase !== 'fetching' && (
            <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '1.5px solid var(--c-line)' }}>
              {/* Thumbnail */}
              {videoInfo.thumbnailUrl && (
                <div className="relative w-full" style={{ paddingBottom: '56.25%', background: 'var(--c-ink-bg)' }}>
                  <img src={videoInfo.thumbnailUrl} alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(35,115,82,0.85)', backdropFilter: 'blur(4px)' }}>
                      <Download size={20} color="white" />
                    </div>
                  </div>
                </div>
              )}
              {/* Tweet meta */}
              <div className="p-3">
                {videoInfo.authorName && (
                  <p className="text-xs font-bold mb-1" style={{ color: 'var(--c-ink)' }}>
                    {videoInfo.authorName}
                    {videoInfo.authorHandle && <span style={{ color: 'var(--c-text3)', fontWeight: 400 }}> @{videoInfo.authorHandle}</span>}
                  </p>
                )}
                {videoInfo.tweetText && (
                  <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--c-text2)' }}>
                    {videoInfo.tweetText.slice(0, 280)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Quality selector (shown after fetch) ── */}
          {videoInfo && (
            <>
              <label className="block text-xs font-black uppercase tracking-wider mb-2" style={{ color: 'var(--c-brand-text)' }}>
                Quality — {videoInfo.variants.length} option{videoInfo.variants.length !== 1 ? 's' : ''} available
              </label>
              <div className="flex gap-2 mb-4">
                {videoInfo.variants.map((v, i) => (
                  <QualityBadge
                    key={i}
                    quality={v.quality}
                    selected={selectedQ === i}
                    onClick={() => setSelectedQ(i)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Progress bar */}
          {phase === 'downloading' && (
            <div className="mb-4">
              <ProgressBar pct={progress} />
              <p className="text-xs text-center" style={{ color: 'var(--c-brand-text)' }}>
                {progress < 5 ? 'Starting…' : progress < 95 ? `Downloading… ${progress}%` : 'Saving…'}
              </p>
            </div>
          )}

          {/* ── Primary action button ── */}
          {phase === 'idle' || phase === 'fetching' ? (
            <button
              onClick={handleFetch}
              data-tally="find-video"
              disabled={!url.trim() || phase === 'fetching'}
              className="btn-primary w-full"
              style={{
                fontSize: '1.0rem', padding: '15px', borderRadius: 14,
                boxShadow: url.trim() && phase === 'idle' ? '0 8px 28px rgba(35,115,82,0.35)' : 'none',
                opacity: (!url.trim() || phase === 'fetching') ? 0.5 : 1,
              }}>
              {phase === 'fetching'
                ? <><Loader2 size={17} className="animate-spin" /> Looking up video…</>
                : <><Download size={17} /> Find Video</>
              }
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                data-tally="download"
                disabled={phase === 'downloading'}
                className="btn-primary flex-1"
                style={{
                  fontSize: '0.9375rem', padding: '14px', borderRadius: 14,
                  opacity: phase === 'downloading' ? 0.5 : 1,
                  boxShadow: phase !== 'downloading' ? '0 8px 28px rgba(35,115,82,0.35)' : 'none',
                }}>
                {phase === 'downloading'
                  ? <><Loader2 size={16} className="animate-spin" /> Downloading…</>
                  : <><Download size={16} /> Download {videoInfo?.variants[selectedQ]?.quality}</>
                }
              </button>
              <button
                onClick={reset}
                disabled={phase === 'downloading'}
                className="btn-secondary"
                style={{ padding: '14px 16px', borderRadius: 14 }}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* Status line */}
          <p className="text-xs text-center mt-2" style={{ color: 'var(--c-text3)' }}>
            {videoInfo
              ? `${videoInfo.provider === 'tiktok' ? '♪' : '𝕏'} · ${videoInfo.variants[selectedQ]?.quality}${videoInfo.variants[selectedQ]?.bitrate ? ` · ${(videoInfo.variants[selectedQ].bitrate / 1000000).toFixed(1)} Mbps` : ''}`
              : 'X · TikTok'}
          </p>
        </div>

        {/* Share tip card */}
        {!url && (
          <div className="card p-5 text-center">
            <Share2 size={22} className="mx-auto mb-2" style={{ color: 'var(--c-line)' }} />
            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--c-text3)' }}>Share directly from the app</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--c-line)' }}>
              On Android: tap Share on any X or TikTok post → choose myDownloader from the share sheet
            </p>
          </div>
        )}

        <p className="text-xs text-center pb-2" style={{ color: 'var(--c-faint)' }}>
          ⚡ Nothing stored · no sign-in · no cost · no ads
        </p>
      </div>

      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function HistoryPage({ onNavigate, setSharedUrl }) {
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('myd_history') || '[]'); } catch { return []; }
  });

  const clearAll   = () => { localStorage.removeItem('myd_history'); setHistory([]); };
  const reDownload = item => { setSharedUrl?.(item.url); onNavigate('downloader', item.url); };

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black" style={{ color: 'var(--c-ink)', letterSpacing: '-0.02em' }}>History</h1>
          <p className="text-xs" style={{ color: 'var(--c-text3)' }}>{history.length} download{history.length !== 1 ? 's' : ''}</p>
        </div>
        {history.length > 0 && (
          <button onClick={clearAll} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ color: 'var(--c-danger)', background: 'var(--c-danger-bg)' }}>
            <Trash2 size={12} /> Clear all
          </button>
        )}
      </div>

      <div className="px-4 pb-4">
        {history.length === 0 ? (
          <div className="card p-10 text-center">
            <Clock size={32} className="mx-auto mb-3" style={{ color: 'var(--c-line)' }} />
            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--c-text3)' }}>No downloads yet</p>
            <p className="text-xs mb-4" style={{ color: 'var(--c-line)' }}>Downloads you make will appear here</p>
            <button onClick={() => onNavigate('downloader')} className="btn-primary"
              style={{ fontSize: '0.8125rem', padding: '10px 20px' }}>
              <Download size={14} /> Start downloading
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {history.map((item, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate mb-1" style={{ color: 'var(--c-ink)' }}>
                      {item.title || item.url}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: 'var(--c-tint)', color: 'var(--c-brand-text)' }}>
                        🎬 {item.quality}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--c-text3)' }}>
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => reDownload(item)} className="p-2 rounded-lg"
                      style={{ background: 'var(--c-tint)', color: 'var(--c-brand-text)' }}>
                      <Download size={14} />
                    </button>
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-lg" style={{ background: 'var(--c-bg)', color: 'var(--c-text2)' }}>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-black uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--c-brand-text)' }}>{title}</p>
      <div className="card overflow-hidden">{children}</div>
    </div>
  );
}

function Row({ label, desc, last, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5"
      style={{ borderBottom: last ? 'none' : '1px solid var(--c-surface-2)' }}>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--c-ink)' }}>{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: 'var(--c-text3)' }}>{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { theme, setTheme, fontScale, setFontScale } = useApp();
  const [saved, setSaved] = useState(false);
  const [histCount, setHistCount] = useState(() => {
    try { return JSON.parse(localStorage.getItem('myd_history') || '[]').length; } catch { return 0; }
  });

  const clearHistory = () => {
    localStorage.removeItem('myd_history');
    setHistCount(0);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-xl font-black mb-0.5" style={{ color: 'var(--c-ink)', letterSpacing: '-0.02em' }}>Settings</h1>
        <p className="text-xs" style={{ color: 'var(--c-text3)' }}>App info and preferences</p>
      </div>
      <div className="px-4 pb-4">
        <Section title="How it works">
          <Row label="Nothing stored" desc="Videos stream through a small proxy that keeps nothing, straight to your device. No ads, no ad trackers.">
            <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'var(--c-tint)', color: 'var(--c-brand-text)' }}>✓</span>
          </Row>
          <Row label="No sign-in" desc="No account and no API key. Visits are counted anonymously." last>
            <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'var(--c-tint)', color: 'var(--c-brand-text)' }}>✓</span>
          </Row>
        </Section>

        <Section title="Appearance">
          <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--c-surface-2)' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--c-ink)' }}>Lighting</p>
            <Segmented label="Lighting" value={theme} options={THEMES} onChange={setTheme} />
          </div>
          <div className="px-4 py-3.5">
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--c-ink)' }}>Text size</p>
            <Segmented label="Text size" value={fontScale} options={SCALES} onChange={setFontScale} />
          </div>
        </Section>

        <Section title="Privacy">
          <Row label="Download history"
            desc={`${histCount} item${histCount !== 1 ? 's' : ''} stored locally on this device`}
            last>
            <button onClick={clearHistory}
              className="text-xs px-3 py-1.5 rounded-lg font-bold"
              style={{ background: saved ? 'var(--c-tint)' : 'var(--c-danger-bg)', color: saved ? 'var(--c-brand-text)' : 'var(--c-danger)' }}>
              {saved ? 'Cleared ✓' : 'Clear'}
            </button>
          </Row>
        </Section>

        <Section title="About">
          <Row label="Platform support" desc="X · TikTok">
            <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'var(--c-tint)', color: 'var(--c-brand-text)' }}>𝕏</span>
          </Row>
          <Row label="Version">
            <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'var(--c-tint)', color: 'var(--c-brand-text)' }}>v{pkg.version}</span>
          </Row>
          <Row label="Made by" last>
            <a href={SUPPORT.authorUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm font-semibold" style={{ color: 'var(--c-brand-text)' }}>
              Made with ❤️ by {SUPPORT.authorName}
            </a>
          </Row>
        </Section>
      </div>
      <Footer />
    </div>
  );
}


// A row of mutually exclusive choices. 44px targets, never colour alone (the chosen one is also bold and ticked).
function Segmented({ label, value, options, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" aria-pressed={on} onClick={() => onChange(o.id)}
            style={{
              minHeight: 44, padding: '0 16px', borderRadius: 9999, fontSize: '0.875rem',
              fontWeight: on ? 700 : 500, cursor: 'pointer',
              border: `1.5px solid ${on ? 'var(--c-brand-text)' : 'var(--c-line)'}`,
              background: on ? 'var(--c-tint)' : 'transparent',
              color: on ? 'var(--c-brand-text)' : 'var(--c-text2)',
            }}>
            {on ? '✓ ' : ''}{o.label}
          </button>
        );
      })}
    </div>
  );
}
