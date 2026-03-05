import { useState, useEffect, useRef } from 'react';
import {
  Download, Link2, Loader2, AlertCircle, CheckCircle2,
  X, Trash2, ExternalLink, Clock, Settings2, ChevronDown, Share2
} from 'lucide-react';
import Footer, { FooterHighlighted } from '../components/Footer';
import { fetchXVideo, downloadVideo, isXUrl, extractTweetId } from '../lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
function Banner({ type, message, onClose }) {
  const cfg = {
    error:   { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', icon: AlertCircle },
    success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', icon: CheckCircle2 },
    info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb', icon: AlertCircle },
  }[type] || { bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb', icon: AlertCircle };
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
    <div className="w-full rounded-full overflow-hidden mb-2" style={{ height: 6, background: '#e8f0eb' }}>
      <div className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#237352,#2d9164)' }} />
    </div>
  );
}

// ── Quality badge ─────────────────────────────────────────────────────────────
function QualityBadge({ quality, selected, onClick }) {
  return (
    <button onClick={onClick}
      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
      style={{
        background: selected ? '#237352' : '#f8fafb',
        color:      selected ? 'white'   : '#4a5568',
        border:     `2px solid ${selected ? '#237352' : '#e2e8f0'}`,
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

  // Handle incoming shared URL from Android share sheet
  useEffect(() => {
    if (sharedUrl) { setUrl(sharedUrl); setVideoInfo(null); }
  }, [sharedUrl]);

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

    if (!isXUrl(trimmed)) {
      setBanner({ type: 'error', message: 'myDownloader currently supports X (Twitter) posts only. Paste an x.com/… link.' });
      return;
    }

    setPhase('fetching');
    setBanner(null);
    setVideoInfo(null);

    try {
      const info = await fetchXVideo(trimmed);
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
    const handle   = (videoInfo.authorHandle || 'x').replace(/[^a-zA-Z0-9_]/g, '');
    const id       = extractTweetId(url) || 'video';
    const qLabel   = variant.quality.replace(/[^a-zA-Z0-9]/g, '');
    const filename = `${handle}_${id}_${qLabel}.mp4`;

    setPhase('downloading');
    setProgress(0);
    setBanner(null);

    try {
      const result = await downloadVideo(variant.url, filename, setProgress);

      if (result.method === 'tab') {
        setBanner({ type: 'info', message: 'iOS: long-press the video → "Save to Photos" or "Download Linked File".' });
        setPhase('ready');
        return;
      }

      // Save to history
      try {
        const hist = JSON.parse(localStorage.getItem('myd_history') || '[]');
        hist.unshift({
          url, title: `@${handle} · ${variant.quality}`,
          quality: variant.quality, date: Date.now(), filename,
        });
        localStorage.setItem('myd_history', JSON.stringify(hist.slice(0, 50)));
      } catch { /* storage full — ignore */ }

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
            style={{ background: 'linear-gradient(135deg,#237352,#2d9164)', boxShadow: '0 12px 32px rgba(35,115,82,0.35)' }}>
            <CheckCircle2 size={38} color="white" />
          </div>
          <h2 className="text-2xl font-black mb-2" style={{ color: '#0f1923', letterSpacing: '-0.02em' }}>
            Saved!
          </h2>
          <p className="text-sm mb-1" style={{ color: '#64748b' }}>
            🎬 {variant?.quality} · @{videoInfo?.authorHandle}
          </p>
          <p className="text-xs mb-8" style={{ color: '#94a3b8' }}>Check your Downloads folder</p>
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
        <h1 className="text-xl font-black mb-0.5" style={{ color: '#0f1923', letterSpacing: '-0.02em' }}>
          X Video Downloader
        </h1>
        <p className="text-xs" style={{ color: '#94a3b8' }}>Paste an X post link · pick quality · download</p>
      </div>

      <div className="px-4 py-3 flex flex-col gap-3">
        {banner && <Banner type={banner.type} message={banner.message} onClose={() => setBanner(null)} />}

        <div className="card p-4">
          {/* URL input */}
          <label className="block text-xs font-black uppercase tracking-wider mb-2" style={{ color: '#237352' }}>
            X Post URL
          </label>
          <div className="relative mb-4">
            <Link2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#b0bec5' }} />
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setVideoInfo(null); setPhase('idle'); setBanner(null); setSharedUrl?.(e.target.value); }}
              onKeyDown={e => e.key === 'Enter' && phase === 'idle' && handleFetch()}
              placeholder="https://x.com/user/status/…"
              className="url-input"
              style={{ paddingLeft: '38px', fontSize: 14 }}
            />
          </div>

          {/* ── Video info card (shown after fetch) ── */}
          {videoInfo && phase !== 'fetching' && (
            <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '1.5px solid #e2e8f0' }}>
              {/* Thumbnail */}
              {videoInfo.thumbnailUrl && (
                <div className="relative w-full" style={{ paddingBottom: '56.25%', background: '#0f1923' }}>
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
                  <p className="text-xs font-bold mb-1" style={{ color: '#0f1923' }}>
                    {videoInfo.authorName}
                    {videoInfo.authorHandle && <span style={{ color: '#94a3b8', fontWeight: 400 }}> @{videoInfo.authorHandle}</span>}
                  </p>
                )}
                {videoInfo.tweetText && (
                  <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#64748b' }}>
                    {videoInfo.tweetText.slice(0, 280)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Quality selector (shown after fetch) ── */}
          {videoInfo && (
            <>
              <label className="block text-xs font-black uppercase tracking-wider mb-2" style={{ color: '#237352' }}>
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
              <p className="text-xs text-center" style={{ color: '#237352' }}>
                {progress < 5 ? 'Starting…' : progress < 95 ? `Downloading… ${progress}%` : 'Saving…'}
              </p>
            </div>
          )}

          {/* ── Primary action button ── */}
          {phase === 'idle' || phase === 'fetching' ? (
            <button
              onClick={handleFetch}
              disabled={!url.trim() || phase === 'fetching'}
              className="btn-primary w-full"
              style={{
                fontSize: 16, padding: '15px', borderRadius: 14,
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
                disabled={phase === 'downloading'}
                className="btn-primary flex-1"
                style={{
                  fontSize: 15, padding: '14px', borderRadius: 14,
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
          <p className="text-xs text-center mt-2" style={{ color: '#94a3b8' }}>
            {videoInfo
              ? `𝕏 · ${videoInfo.variants[selectedQ]?.quality} · ${(videoInfo.variants[selectedQ]?.bitrate / 1000000).toFixed(1)} Mbps`
              : '𝕏 · Direct from X CDN · no backend'}
          </p>
        </div>

        {/* Share tip card */}
        {!url && (
          <div className="card p-5 text-center">
            <Share2 size={22} className="mx-auto mb-2" style={{ color: '#c8d8ce' }} />
            <p className="font-semibold text-sm mb-1" style={{ color: '#9ca3af' }}>Share directly from X</p>
            <p className="text-xs leading-relaxed" style={{ color: '#d1d5db' }}>
              On Android: tap Share on any X post → choose myDownloader from the share sheet
            </p>
          </div>
        )}

        <p className="text-xs text-center pb-2" style={{ color: '#b0bec5' }}>
          ⚡ Direct from X's CDN · no servers · no cost · no tracking
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
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem('myd_history') || '[]')); } catch { setHistory([]); }
  }, []);

  const clearAll   = () => { localStorage.removeItem('myd_history'); setHistory([]); };
  const reDownload = item => { setSharedUrl?.(item.url); onNavigate('downloader', item.url); };

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black" style={{ color: '#0f1923', letterSpacing: '-0.02em' }}>History</h1>
          <p className="text-xs" style={{ color: '#94a3b8' }}>{history.length} download{history.length !== 1 ? 's' : ''}</p>
        </div>
        {history.length > 0 && (
          <button onClick={clearAll} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ color: '#dc2626', background: '#fef2f2' }}>
            <Trash2 size={12} /> Clear all
          </button>
        )}
      </div>

      <div className="px-4 pb-4">
        {history.length === 0 ? (
          <div className="card p-10 text-center">
            <Clock size={32} className="mx-auto mb-3" style={{ color: '#e2e8f0' }} />
            <p className="font-semibold text-sm mb-1" style={{ color: '#9ca3af' }}>No downloads yet</p>
            <p className="text-xs mb-4" style={{ color: '#d1d5db' }}>Downloads you make will appear here</p>
            <button onClick={() => onNavigate('downloader')} className="btn-primary"
              style={{ fontSize: 13, padding: '10px 20px' }}>
              <Download size={14} /> Start downloading
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {history.map((item, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate mb-1" style={{ color: '#0f1923' }}>
                      {item.title || item.url}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: '#e8f5ee', color: '#237352' }}>
                        🎬 {item.quality}
                      </span>
                      <span className="text-xs" style={{ color: '#94a3b8' }}>
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => reDownload(item)} className="p-2 rounded-lg"
                      style={{ background: '#e8f5ee', color: '#237352' }}>
                      <Download size={14} />
                    </button>
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-lg" style={{ background: '#f8fafb', color: '#64748b' }}>
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

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function SettingsPage() {
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

  const Section = ({ title, children }) => (
    <div className="mb-5">
      <p className="text-xs font-black uppercase tracking-widest mb-2 px-1" style={{ color: '#237352' }}>{title}</p>
      <div className="card overflow-hidden">{children}</div>
    </div>
  );
  const Row = ({ label, desc, last, children }) => (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5"
      style={{ borderBottom: last ? 'none' : '1px solid #f1f5f9' }}>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: '#0f1923' }}>{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-xl font-black mb-0.5" style={{ color: '#0f1923', letterSpacing: '-0.02em' }}>Settings</h1>
        <p className="text-xs" style={{ color: '#94a3b8' }}>App info and preferences</p>
      </div>
      <div className="px-4 pb-4">
        <Section title="How it works">
          <Row label="No backend" desc="Videos are fetched directly from X's own CDN. No server, no cost, no tracking.">
            <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: '#e8f5ee', color: '#237352' }}>✓</span>
          </Row>
          <Row label="No sign-in" desc="No account, no API key, no rate limit for personal use." last>
            <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: '#e8f5ee', color: '#237352' }}>✓</span>
          </Row>
        </Section>

        <Section title="Privacy">
          <Row label="Download history"
            desc={`${histCount} item${histCount !== 1 ? 's' : ''} stored locally on this device`}
            last>
            <button onClick={clearHistory}
              className="text-xs px-3 py-1.5 rounded-lg font-bold"
              style={{ background: saved ? '#e8f5ee' : '#fef2f2', color: saved ? '#237352' : '#dc2626' }}>
              {saved ? 'Cleared ✓' : 'Clear'}
            </button>
          </Row>
        </Section>

        <Section title="About">
          <Row label="Platform support" desc="X (Twitter) · more platforms coming soon">
            <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: '#e8f5ee', color: '#237352' }}>𝕏</span>
          </Row>
          <Row label="Version" last>
            <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: '#e8f5ee', color: '#237352' }}>v6.3</span>
          </Row>
        </Section>
      </div>
      <Footer />
    </div>
  );
}
