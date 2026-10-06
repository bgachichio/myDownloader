import { useState, useEffect } from 'react';
import Sidebar, { BottomNav } from './components/Sidebar';
import Topbar from './components/Topbar';
import SupportSheet from './components/SupportSheet';
import LandingPage from './pages/LandingPage';
import { DownloaderPage, HistoryPage, SettingsPage } from './pages/OtherPages';

const pages = {
  home: LandingPage,
  downloader: DownloaderPage,
  history: HistoryPage,
  settings: SettingsPage,
};

const pageTitles = {
  home: '', downloader: 'Download', history: 'History', settings: 'Settings',
};

// Extract shared URL from Web Share Target API query params
// Android share sheet calls: /?url=https://x.com/...&title=...&text=...
function getSharedUrl() {
  const params = new URLSearchParams(window.location.search);
  const candidate = params.get('url') || params.get('text') || '';
  // Extract URL from text (in case the full text contains a URL)
  const urlMatch = candidate.match(/https?:\/\/[^\s]+/);
  return urlMatch ? urlMatch[0] : candidate;
}

export default function App() {
  // Android share sheet: /?url=... opens straight on the downloader with the link filled in
  const [incoming] = useState(() => getSharedUrl());
  const [activePage, setActivePage] = useState(() => (incoming ? 'downloader' : 'home'));
  const [sharedUrl, setSharedUrl]   = useState(incoming);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Clean the URL bar after a share, without a reload
  useEffect(() => {
    if (incoming) window.history.replaceState({}, '', '/');
  }, [incoming]);

  // Tally counts each screen as a page (the app changes screens without changing the address). Screen names only, never user input.
  useEffect(() => { window.tally?.page(activePage === 'home' ? '/' : `/${activePage}`); }, [activePage]);

  const PageComponent = pages[activePage] || LandingPage;

  const handleNavigate = (page, url = '') => {
    if (url) setSharedUrl(url);
    setActivePage(page);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--c-bg)' }}>
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <Topbar title={pageTitles[activePage]} onMenuOpen={() => setDrawerOpen(true)} />
      <main className="flex-1 flex flex-col page-scroll">
        <PageComponent
          onNavigate={handleNavigate}
          sharedUrl={sharedUrl}
          setSharedUrl={setSharedUrl}
        />
      </main>
      <BottomNav activePage={activePage} onNavigate={handleNavigate} />
      <SupportSheet />
    </div>
  );
}
