import { Coffee, Heart } from 'lucide-react';

// Standard footer shown on most pages
export default function Footer() {
  return (
    <footer className="w-full py-4 px-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm"
      style={{ borderTop: '1px solid #e8f0eb', background: 'white' }}>
      <span className="flex items-center gap-1.5" style={{ color: '#6b7280', fontSize: 13 }}>
        Made with <Heart size={12} fill="#ef4444" stroke="none" /> by{' '}
        <a href="https://linkedin.com/in/briangachichio" target="_blank" rel="noopener noreferrer"
          style={{ color: '#237352', fontWeight: 600 }}>Brian Gachichio</a>
      </span>
      <a href="https://paystack.shop/pay/gachichio" target="_blank" rel="noopener noreferrer"
        className="btn-secondary" style={{ padding: '7px 14px', fontSize: 13 }}>
        <Coffee size={13} /> ☕ Support
      </a>
    </footer>
  );
}

// Highlighted footer shown on download success screen
export function FooterHighlighted() {
  return (
    <div className="mx-4 mb-4 rounded-2xl p-5 text-center"
      style={{ background: 'linear-gradient(135deg,#237352,#2d9164)', color: 'white' }}>
      <p className="text-sm font-medium opacity-90 mb-1">Enjoying myDownloader?</p>
      <p className="text-xs opacity-75 mb-4">
        Made with ❤️ by <strong>Brian Gachichio</strong>
      </p>
      <a href="https://paystack.shop/pay/gachichio" target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
        style={{ background: 'white', color: '#237352' }}>
        <Coffee size={15} /> ☕ Buy me a coffee
      </a>
    </div>
  );
}
