import { useState, useEffect } from 'react';
import {
  Download, Link2, Music, Video, ChevronDown, Loader2,
  AlertCircle, CheckCircle2, X, Info, Clock, Trash2,
  ExternalLink, RefreshCw, Settings2, ArrowLeft, Coffee, Heart
} from 'lucide-react';
import Footer, { FooterHighlighted } from '../components/Footer';

const API = 'http://localhost:3001/api';

const VIDEO_QUALITIES = [
  { value: 'best', label: 'Best Quality (Original)' },
  { value: '1080', label: '1080p Full HD' },
  { value: '720',  label: '720p HD' },
  { value: '480',  label: '480p SD' },
  { value: '360',  label: '360p' },
];
const AUDIO_QUALITIES = [
  { value: '320',  label: '320 kbps MP3 (High)' },
  { value: '192',  label: '192 kbps MP3 (Standard)' },
  { value: '128',  label: '128 kbps MP3 (Compact)' },
  { value: 'flac', label: 'FLAC (Lossless)' },
];

function StatusBanner({ type, message, onClose }) {
  const s = {
    error:   { bg: '#fef2f2', border: '#fecaca', icon: AlertCircle,  color: '#dc2626' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', icon: CheckCircle2, color: '#16a34a' },
    info:    { bg: '#eff6ff', border: '#bfdbfe', icon: Info,         color: '#2563eb' },
  }[type] || { bg: '#eff6ff', border: '#bfdbfe', icon: Info, color: '#2563eb' };
  const Icon = s.icon;
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl mb-4"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}>
      <Icon size={15} style={{ color: s.color, marginTop: 1, flexShrink: 0 }} />
      <p className="text-sm flex-1 leading-snug" style={{ color: s.color }}>{message}</p>
      {onClose && <button onClick={onClose}><X size={13} style={{ color: s.color }} /></button>}
    </div>
  );
}

// ── Downloader ────────────────────────────────────────────────────────────────
export function DownloaderPage({ sharedUrl, setSharedUrl }) {
  const [url, setUrl]         = useState(sharedUrl || '');
  const [mode, setMode]       = useState('video');
  const [quality, setQuality] = useState('best');
  const [status, setStatus]   = useState(null);
  const [phase, setPhase]     = useState('idle'); // idle | fetching | downloading
  const [info, setInfo]       = useState(null);
  const [ytdlpOk, setYtdlpOk] = useState(null);
  const [downloaded, setDownloaded] = useState(null); // success state

  useEffect(() => { if (sharedUrl) setUrl(sharedUrl); }, [sharedUrl]);
  useEffect(() => {
    if (sharedUrl) handleFetchInfo(sharedUrl);
    fetch(`${API}/health`).then(r => r.json()).then(d => setYtdlpOk(d.ytdlp)).catch(() => setYtdlpOk(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFetchInfo = async (targetUrl) => {
    const u = (targetUrl || url).trim();
    if (!u) return;
    setPhase('fetching'); setStatus(null); setInfo(null);
    try {
      const res  = await fetch(`${API}/info`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: u }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch info');
      setInfo(data);
    } catch (err) { setStatus({ type: 'error', message: err.message }); }
    finally { setPhase('idle'); }
  };

  const handleDownload = async () => {
    if (!url.trim()) return;
    setPhase('downloading');
    setStatus({ type: 'info', message: 'Preparing your download… this may take a moment.' });
    try {
      const params = new URLSearchParams({ url: url.trim(), mode, quality });
      const res = await fetch(`${API}/download?${params}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Download failed'); }
      const blob = await res.blob();
      const disp = res.headers.get('Content-Disposition') || '';
      const nameMatch = disp.match(/filename="(.+?)"/);
      const filename = nameMatch ? nameMatch[1] : `myDownloader_${Date.now()}.${mode === 'audio' ? 'mp3' : 'mp4'}`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob); link.download = filename;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(link.href);

      const history = JSON.parse(localStorage.getItem('myd_history') || '[]');
      history.unshift({ url: url.trim(), title: info?.title || url, mode, quality, date: Date.now(), filename });
      localStorage.setItem('myd_history', JSON.stringify(history.slice(0, 50)));

      setDownloaded({ title: info?.title || url, filename, mode });
      setStatus(null);
    } catch (err) { setStatus({ type: 'error', message: err.message }); }
    finally { setPhase('idle'); }
  };

  // ── Success screen ────────────────────────────────────────────
  if (downloaded) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 text-center fade-in">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 pulse-glow-anim"
            style={{ background: 'linear-gradient(135deg,#237352,#2d9164)' }}>
            <CheckCircle2 size={38} color="white" />
          </div>
          <h2 className="text-2xl font-black mb-2" style={{ color: '#0f1923', letterSpacing: '-0.02em' }}>
            Download complete!
          </h2>
          <p className="text-sm mb-1" style={{ color: '#64748b' }}>
            {downloaded.mode === 'audio' ? '🎵' : '🎬'} {downloaded.title}
          </p>
          <p className="text-xs mb-8" style={{ color: '#94a3b8' }}>Saved to your Downloads folder</p>

          <button
            onClick={() => { setDownloaded(null); setUrl(''); setInfo(null); setSharedUrl && setSharedUrl(''); }}
            className="btn-primary mb-3 w-full max-w-xs"
          >
            <Download size={16} /> Download another
          </button>
        </div>

        {/* Highlighted attribution */}
        <FooterHighlighted />
      </div>
    );
  }

  const qualityOptions = mode === 'audio' ? AUDIO_QUALITIES : VIDEO_QUALITIES;

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-6 pb-2">
        <h1 className="text-xl font-black mb-0.5" style={{ color: '#0f1923', letterSpacing: '-0.02em' }}>Download Content</h1>
        <p className="text-xs" style={{ color: '#94a3b8' }}>Paste a URL · pick options · download</p>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {ytdlpOk === false && (
          <StatusBanner type="error" message="yt-dlp not found. Run: pipx install yt-dlp — then restart with npm run dev" />
        )}
        {status && <StatusBanner type={status.type} message={status.message} onClose={() => setStatus(null)} />}

        {/* Video info preview */}
        {info && (
          <div className="card p-3 flex gap-3 items-center fade-in">
            {info.thumbnail && <img src={info.thumbnail} alt="" className="w-16 h-12 object-cover rounded-lg flex-shrink-0" />}
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: '#0f1923' }}>{info.title}</p>
              <p className="text-xs" style={{ color: '#94a3b8' }}>
                {info.uploader && `${info.uploader} · `}{info.platform}
                {info.duration && ` · ${Math.floor(info.duration/60)}:${String(info.duration%60).padStart(2,'0')}`}
              </p>
            </div>
          </div>
        )}

        {/* URL input */}
        <div className="card p-4">
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#237352' }}>Content URL</label>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Link2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#b0bec5' }} />
              <input
                type="url" value={url}
                onChange={e => { setUrl(e.target.value); setSharedUrl && setSharedUrl(e.target.value); setInfo(null); }}
                onKeyDown={e => e.key === 'Enter' && handleFetchInfo()}
                placeholder="https://x.com/…"
                className="url-input" style={{ paddingLeft: '38px', fontSize: 14 }}
              />
            </div>
            <button onClick={() => handleFetchInfo()} disabled={!url.trim() || phase==='fetching'}
              className="btn-secondary flex-shrink-0" style={{ padding: '12px 14px' }} title="Fetch info">
              {phase === 'fetching' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
          </div>

          {/* Mode toggle */}
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#237352' }}>Type</label>
          <div className="flex gap-2 mb-4">
            {[{ id:'video', label:'Video', icon:Video }, { id:'audio', label:'Audio Only', icon:Music }].map(({ id, label, icon:Icon }) => (
              <button key={id} onClick={() => { setMode(id); setQuality(id==='audio'?'192':'best'); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: mode===id?'#237352':'#f8fafb', color: mode===id?'white':'#4a5568', border:`1.5px solid ${mode===id?'#237352':'#e2e8f0'}` }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {/* Quality */}
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#237352' }}>Quality</label>
          <div className="relative mb-5">
            <select value={quality} onChange={e => setQuality(e.target.value)}
              className="w-full appearance-none py-3 px-4 pr-10 rounded-xl text-sm font-medium"
              style={{ border:'2px solid #e2e8f0', background:'white', color:'#374151', outline:'none' }}>
              {qualityOptions.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
            </select>
            <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color:'#94a3b8' }} />
          </div>

          {/* Download button — prominent */}
          <button onClick={handleDownload}
            disabled={!url.trim() || phase!=='idle' || ytdlpOk===false}
            className="btn-primary w-full"
            style={{ fontSize:16, padding:'15px', borderRadius:14,
              boxShadow: url.trim() && phase==='idle' ? '0 8px 28px rgba(35,115,82,0.35)' : 'none' }}>
            {phase==='downloading'
              ? <><Loader2 size={17} className="animate-spin" /> Downloading…</>
              : <><Download size={17} /> Download {mode==='audio'?'Audio':'Video'}</>}
          </button>
        </div>

        <p className="text-xs text-center pb-2" style={{ color: '#b0bec5' }}>
          ⚡ All processing is local · powered by yt-dlp
        </p>
      </div>

      <Footer />
    </div>
  );
}

// ── History ───────────────────────────────────────────────────────────────────
export function HistoryPage({ onNavigate, setSharedUrl }) {
  const [history, setHistory] = useState([]);
  useEffect(() => { setHistory(JSON.parse(localStorage.getItem('myd_history') || '[]')); }, []);

  const clearAll = () => { localStorage.removeItem('myd_history'); setHistory([]); };
  const reDownload = item => { if (setSharedUrl) setSharedUrl(item.url); onNavigate('downloader', item.url); };

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black" style={{ color:'#0f1923', letterSpacing:'-0.02em' }}>History</h1>
          <p className="text-xs" style={{ color:'#94a3b8' }}>{history.length} download{history.length!==1?'s':''}</p>
        </div>
        {history.length > 0 && (
          <button onClick={clearAll} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ color:'#dc2626', background:'#fef2f2' }}>
            <Trash2 size={12} /> Clear all
          </button>
        )}
      </div>

      <div className="px-4 pb-4">
        {history.length === 0 ? (
          <div className="card p-10 text-center">
            <Clock size={32} className="mx-auto mb-3" style={{ color:'#e2e8f0' }} />
            <p className="font-semibold text-sm" style={{ color:'#9ca3af' }}>No downloads yet</p>
            <p className="text-xs mt-1 mb-5" style={{ color:'#d1d5db' }}>Your history will appear here</p>
            <button onClick={() => onNavigate('downloader')} className="btn-primary" style={{ fontSize:13, padding:'10px 20px' }}>
              <Download size={14} /> Start downloading
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {history.map((item, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate mb-1" style={{ color:'#0f1923' }}>{item.title || item.url}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background:'#e8f5ee', color:'#237352', fontWeight:600 }}>
                        {item.mode==='audio'?'🎵':'🎬'} {item.quality}
                      </span>
                      <span className="text-xs" style={{ color:'#94a3b8' }}>{new Date(item.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => reDownload(item)} className="p-2 rounded-lg" style={{ background:'#e8f5ee', color:'#237352' }}>
                      <Download size={14} />
                    </button>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg" style={{ background:'#f8fafb', color:'#64748b' }}>
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

// ── Settings ──────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('myd_settings') || '{}'); } catch { return {}; }
  });
  const [saved, setSaved] = useState(false);
  const update = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const save = () => { localStorage.setItem('myd_settings', JSON.stringify(settings)); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const Section = ({ title, children }) => (
    <div className="mb-5">
      <p className="text-xs font-black uppercase tracking-widest mb-2 px-1" style={{ color:'#237352' }}>{title}</p>
      <div className="card overflow-hidden">{children}</div>
    </div>
  );

  const Row = ({ label, desc, last, children }) => (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5"
      style={{ borderBottom: last ? 'none' : '1px solid #f1f5f9' }}>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color:'#0f1923' }}>{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color:'#94a3b8' }}>{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );

  const Toggle = ({ value, onChange }) => (
    <button onClick={() => onChange(!value)}
      className="w-11 h-6 rounded-full relative transition-all"
      style={{ background: value ? '#237352' : '#e2e8f0' }}>
      <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
        style={{ left: value ? '24px' : '4px' }} />
    </button>
  );

  const Sel = ({ value, onChange, options }) => (
    <div className="relative">
      <select value={value || options[0].value} onChange={e => onChange(e.target.value)}
        className="appearance-none text-xs font-semibold pl-3 pr-7 py-2 rounded-lg"
        style={{ border:'1.5px solid #e2e8f0', background:'white', color:'#374151', outline:'none' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color:'#94a3b8' }} />
    </div>
  );

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-xl font-black mb-0.5" style={{ color:'#0f1923', letterSpacing:'-0.02em' }}>Settings</h1>
        <p className="text-xs" style={{ color:'#94a3b8' }}>Customise your download preferences</p>
      </div>

      <div className="px-4 pb-4">
        <Section title="Defaults">
          <Row label="Download type" desc="Default when opening Downloader">
            <Sel value={settings.defaultMode||'video'} onChange={v=>update('defaultMode',v)}
              options={[{value:'video',label:'Video'},{value:'audio',label:'Audio'}]} />
          </Row>
          <Row label="Video quality" desc="Preferred resolution">
            <Sel value={settings.defaultVideoQuality||'best'} onChange={v=>update('defaultVideoQuality',v)} options={VIDEO_QUALITIES} />
          </Row>
          <Row label="Audio quality" desc="Preferred bitrate" last>
            <Sel value={settings.defaultAudioQuality||'192'} onChange={v=>update('defaultAudioQuality',v)} options={AUDIO_QUALITIES} />
          </Row>
        </Section>

        <Section title="Behaviour">
          <Row label="Auto-fetch video info" desc="Fetch details when URL is pasted">
            <Toggle value={settings.autoFetch!==false} onChange={v=>update('autoFetch',v)} />
          </Row>
          <Row label="Save download history" desc="Keep a local log">
            <Toggle value={settings.saveHistory!==false} onChange={v=>update('saveHistory',v)} />
          </Row>
          <Row label="Clear history on exit" last>
            <Toggle value={!!settings.clearOnExit} onChange={v=>update('clearOnExit',v)} />
          </Row>
        </Section>

        <Section title="Privacy">
          <Row label="Clear all history now"
            desc={`${JSON.parse(localStorage.getItem('myd_history')||'[]').length} items stored`} last>
            <button onClick={() => { localStorage.removeItem('myd_history'); window.location.reload(); }}
              className="text-xs px-3 py-1.5 rounded-lg font-bold"
              style={{ background:'#fef2f2', color:'#dc2626' }}>
              Clear
            </button>
          </Row>
        </Section>

        <button onClick={save} className="btn-primary w-full mt-1"
          style={{ fontSize:15, padding:'14px', boxShadow:'0 8px 28px rgba(35,115,82,0.3)' }}>
          {saved ? <><CheckCircle2 size={16} /> Saved!</> : <><Settings2 size={16} /> Save Settings</>}
        </button>
      </div>

      <Footer />
    </div>
  );
}
