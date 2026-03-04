import { useState } from 'react';
import { Download, Link2, Music, Video, Shield, Zap, ArrowRight, CheckCircle2, Wifi } from 'lucide-react';
import Footer from '../components/Footer';

const platforms = [
  { name: 'X',         emoji: '𝕏' },
  { name: 'Instagram', emoji: '📸' },
  { name: 'TikTok',    emoji: '🎵' },
  { name: 'Threads',   emoji: '🧵' },
  { name: 'Substack',  emoji: '📰' },
  { name: 'YouTube',   emoji: '▶️' },
];

const features = [
  { icon: Shield, title: '100% Private',       desc: 'Runs on your device. No uploads, no tracking.',  color: '#237352' },
  { icon: Music,  title: 'Audio Extraction',   desc: 'MP3, FLAC and more in your chosen quality.',      color: '#2d9164' },
  { icon: Video,  title: 'Video Download',     desc: '360p up to original quality.',                    color: '#1a5a3f' },
  { icon: Zap,    title: 'Lightning Fast',     desc: 'Powered by yt-dlp — 1000+ sites supported.',     color: '#237352' },
];

export default function LandingPage({ onNavigate }) {
  const [url, setUrl] = useState('');

  const handleGo = () => {
    if (url.trim()) onNavigate('downloader', url.trim());
  };

  return (
    <div className="flex flex-col">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="px-5 pt-8 pb-6 flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(35,115,82,0.09) 0%, transparent 70%)' }} />

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-5"
          style={{ background: '#e8f5ee', color: '#237352', border: '1px solid #c6e0d0' }}>
          <Wifi size={10} /> 100% local · no cloud · no tracking
        </div>

        <h1 className="text-3xl sm:text-4xl font-black mb-3 leading-tight"
          style={{ color: '#0f1923', letterSpacing: '-0.03em' }}>
          Download any video<br />or audio{' '}
          <span style={{ color: '#237352' }}>instantly</span>
        </h1>
        <p className="text-sm mb-8 max-w-xs" style={{ color: '#64748b', lineHeight: 1.7 }}>
          Paste a link from X, Instagram, TikTok, Threads, Substack and more. Pick quality. Download.
        </p>

        {/* ── CTA — the star of the show ── */}
        <div className="w-full max-w-sm fade-in">
          <div className="rounded-2xl p-1" style={{ background: 'linear-gradient(135deg,#237352,#2d9164)', boxShadow: '0 12px 40px rgba(35,115,82,0.3)' }}>
            <div className="bg-white rounded-xl p-3 flex gap-2">
              <div className="relative flex-1">
                <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#b0bec5' }} />
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGo()}
                  placeholder="Paste URL here…"
                  className="url-input"
                  style={{ paddingLeft: '34px', borderRadius: '10px', fontSize: 14, padding: '12px 12px 12px 34px' }}
                />
              </div>
              <button
                onClick={handleGo}
                disabled={!url.trim()}
                className="btn-primary flex-shrink-0"
                style={{ borderRadius: '10px', padding: '12px 18px', fontSize: 14 }}
              >
                <Download size={15} />
                <span className="sm:inline hidden">Download</span>
              </button>
            </div>
          </div>
          <p className="text-xs mt-2.5 text-center" style={{ color: '#94a3b8' }}>
            Supports X · Instagram · TikTok · Threads · Substack · YouTube + more
          </p>
        </div>

        {/* Platform pills */}
        <div className="flex flex-wrap justify-center gap-1.5 mt-6">
          {platforms.map(p => (
            <span key={p.name} className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'white', border: '1px solid #e2e8f0', color: '#4a5568' }}>
              {p.emoji} {p.name}
            </span>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section className="px-4 py-6">
        <h2 className="text-lg font-bold text-center mb-4" style={{ color: '#0f1923' }}>
          Everything you need, nothing you don't
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="feature-card">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${color}15` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <p className="font-semibold text-sm mb-1" style={{ color: '#0f1923' }}>{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: '#64748b' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Get started CTA strip ────────────────────────────────── */}
      <section className="mx-4 mb-4 rounded-2xl p-6 text-center text-white"
        style={{ background: '#237352' }}>
        <p className="font-bold text-base mb-1">Ready to download?</p>
        <p className="text-xs opacity-75 mb-4">Paste any URL and get your content in seconds.</p>
        <button
          onClick={() => onNavigate('downloader')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
          style={{ background: 'white', color: '#237352' }}
        >
          Get Started <ArrowRight size={14} />
        </button>
        <div className="flex flex-wrap justify-center gap-3 mt-4 text-xs opacity-70">
          {['No sign-up', 'No ads', 'Free forever'].map(t => (
            <span key={t} className="flex items-center gap-1"><CheckCircle2 size={11} /> {t}</span>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
