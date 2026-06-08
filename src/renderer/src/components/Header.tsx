import type {AgentStatus, AgentStatusKind} from '../../../main/types';

const PILL: Record<AgentStatusKind, {label: string; className: string}> = {
  running: {label: 'Running', className: 'pill pill-running'},
  stopped: {label: 'Stopped', className: 'pill pill-stopped'},
  'docker-down': {label: 'Docker not running', className: 'pill pill-warning'},
};

interface HeaderProps {
  status: AgentStatus | null;
  onRefresh: () => void;
}

export function Header({status, onRefresh}: HeaderProps): JSX.Element {
  const kind = status?.kind ?? 'stopped';
  const pill = PILL[kind];

  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <span className="brand-glyph">K</span>
        </div>
        <div className="brand-text">
          <span className="brand-name">
            KIQR <span className="brand-sub">Desktop</span>
          </span>
          <span className="brand-tagline">Local agent &amp; environment monitor</span>
        </div>
      </div>

      <div className="header-right">
        <div className={pill.className} title={status?.message ?? ''}>
          <span className="pill-dot" />
          <span className="pill-label">{pill.label}</span>
        </div>
        <button type="button" className="refresh-btn" onClick={onRefresh}>
          Refresh
        </button>
      </div>
    </header>
  );
}
