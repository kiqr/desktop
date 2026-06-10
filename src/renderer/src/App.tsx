import {useEffect, useState} from 'react';
import type {AgentStatus, SiteStatus} from '../../main/types';
import {AgentBar} from './components/AgentBar';
import {Header} from './components/Header';
import {SitesSection} from './components/SitesSection';

export function App(): JSX.Element {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [sites, setSites] = useState<SiteStatus[]>([]);

  useEffect(() => {
    const offStatus = window.kiqr.onStatus(setStatus);
    const offSites = window.kiqr.onSites(setSites);
    window.kiqr.refresh();
    return () => {
      offStatus();
      offSites();
    };
  }, []);

  return (
    <div className="app">
      <div className="aurora" aria-hidden="true" />
      <Header status={status} onRefresh={() => window.kiqr.refresh()} />
      <main className="content">
        <AgentBar status={status} />
        <SitesSection sites={sites} />
      </main>
      <footer className="footer">
        <span>
          Pairs with <code>@kiqr/cli</code> — your local WordPress dev toolchain.
        </span>
        <span className="footer-dot">·</span>
        <span>Polling Docker every 2s</span>
      </footer>
    </div>
  );
}
