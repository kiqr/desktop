import {useEffect, useMemo, useState} from 'react';
import type {AgentStatus, ClassifiedStat} from '../../main/types';
import {AgentCard} from './components/AgentCard';
import {Header} from './components/Header';
import {ProjectsSection} from './components/ProjectsSection';

export function App(): JSX.Element {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [stats, setStats] = useState<ClassifiedStat[]>([]);

  useEffect(() => {
    const offStatus = window.kiqr.onStatus(setStatus);
    const offStats = window.kiqr.onStats(setStats);
    window.kiqr.refresh();
    return () => {
      offStatus();
      offStats();
    };
  }, []);

  const agentStats = useMemo(() => stats.filter((s) => s.role === 'agent'), [stats]);
  const projectStats = useMemo(() => stats.filter((s) => s.role === 'project'), [stats]);

  return (
    <div className="app">
      <div className="aurora" aria-hidden="true" />
      <Header status={status} onRefresh={() => window.kiqr.refresh()} />
      <main className="content">
        <AgentCard status={status} stats={agentStats} />
        <ProjectsSection status={status} stats={projectStats} />
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
