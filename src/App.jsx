import { useState } from 'react';
import Sidebar, { BottomNav } from './components/Sidebar';
import Topbar from './components/Topbar';
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

export default function App() {
  const [activePage, setActivePage]   = useState('home');
  const [sharedUrl, setSharedUrl]     = useState('');
  const [drawerOpen, setDrawerOpen]   = useState(false);

  const PageComponent = pages[activePage] || LandingPage;

  const handleNavigate = (page, url = '') => {
    if (url) setSharedUrl(url);
    setActivePage(page);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8fafb' }}>
      {/* Hamburger drawer */}
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Topbar */}
      <Topbar title={pageTitles[activePage]} onMenuOpen={() => setDrawerOpen(true)} />

      {/* Page content */}
      <main className="flex-1 flex flex-col page-scroll">
        <PageComponent
          onNavigate={handleNavigate}
          sharedUrl={sharedUrl}
          setSharedUrl={setSharedUrl}
        />
      </main>

      {/* Bottom navigation */}
      <BottomNav activePage={activePage} onNavigate={handleNavigate} />
    </div>
  );
}
