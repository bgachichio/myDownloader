import { useState } from 'react';
import { Download, Link2, Shield, Zap, ArrowRight, CheckCircle2, Server } from 'lucide-react';
import Footer from '../components/Footer';

const features = [
  { icon: Shield, title: '100% Private',     desc: 'No servers. Downloads go direct from X to your device.',  color: '#237352' },
  { icon: Server, title: 'No Backend',       desc: 'Uses X\'s own public embed API. Zero infrastructure.',     color: '#2d9164' },
  { icon: Zap,    title: 'Instant',          desc: 'Video options appear in seconds. No waiting, no queues.',  color: '#1a5a3f' },
  { icon: Download,'title': 'All Qualities', desc: 'Every available resolution: 240p up to 1080p HD.',        color: '#237352' },
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

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-5"
          style={{ background: '#e8f5ee', color: '#237352', border: '1px solid #c6e0d0' }}>
          𝕏 · No servers · No cost · No tracking
        </div>

        <h1 className="text-3xl sm:text-4xl font-black mb-3 leading-tight"
          style={{ color: '#0f1923', letterSpacing: '-0.03em' }}>
          Download X videos<br />
          <span style={{ color: '#237352' }}>directly to your device</span>
        </h1>
        <p className="text-sm mb-8 max-w-xs" style={{ color: '#64748b', lineHeight: 1.7 }}>
          Paste any X post link. Pick your quality. Download straight from X's CDN — no middleman, no backend, completely free.
        </p>

        {/* ── CTA ── */}
        <div className="w-full max-w-sm">
          <div className="rounded-2xl p-1"
            style={{ background: 'linear-gradient(135deg,#237352,#2d9164)', boxShadow: '0 12px 40px rgba(35,115,82,0.3)' }}>
            <div className="bg-white rounded-xl p-3 flex gap-2">
              <div className="relative flex-1">
                <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#b0bec5' }} />
                <input
                  type="url" value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGo()}
                  placeholder="https://x.com/user/status/…"
                  className="url-input"
                  style={{ paddingLeft: '34px', borderRadius: '10px', fontSize: 14, padding: '12px 12px 12px 34px' }}
                />
              </div>
              <button onClick={handleGo} disabled={!url.trim()} className="btn-primary flex-shrink-0"
                style={{ borderRadius: '10px', padding: '12px 18px', fontSize: 14 }}>
                <Download size={15} />
                <span className="sm:inline hidden">Download</span>
              </button>
            </div>
          </div>
          <p className="text-xs mt-2.5 text-center" style={{ color: '#94a3b8' }}>
            Supports all public X posts with video · No sign-in required
          </p>
        </div>

        {/* X pill */}
        <div className="flex gap-2 mt-5">
          <span className="px-3 py-1.5 rounded-full text-sm font-bold"
            style={{ background: '#0f1923', color: 'white' }}>
            𝕏 X (Twitter)
          </span>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section className="px-4 py-6">
        <h2 className="text-lg font-bold text-center mb-4" style={{ color: '#0f1923' }}>
          How it works
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="feature-card">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${color}18` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <p className="font-semibold text-sm mb-1" style={{ color: '#0f1923' }}>{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: '#64748b' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How-to strip ─────────────────────────────────────────── */}
      <section className="mx-4 mb-4 rounded-2xl p-6 text-center text-white"
        style={{ background: '#237352' }}>
        <p className="font-bold text-base mb-1">Three steps, done.</p>
        <p className="text-xs opacity-75 mb-4">Works on Android, iPhone, and desktop.</p>
        <div className="flex flex-col gap-2 text-left mb-4">
          {[
            'Copy any X post URL with a video',
            'Paste it in myDownloader',
            'Pick quality and tap Download',
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.2)' }}>{i + 1}</span>
              <span className="text-sm opacity-90">{step}</span>
            </div>
          ))}
        </div>
        <button onClick={() => onNavigate('downloader')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
          style={{ background: 'white', color: '#237352' }}>
          Try it now <ArrowRight size={14} />
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
