import {useState} from 'react';
import type {AgentStatus, AgentStatusKind} from '../../../main/types';
import type {LifecycleAction} from '../../../preload';
import {ServiceBadge} from './ServiceBadge';

const MAIL_INBOX_URL = 'http://mail.lvh.me:5477';

/** Friendly labels for the shared agent containers. */
const AGENT_LABELS: Record<string, string> = {
  'kiqr-traefik': 'Proxy',
  'kiqr-splash': 'Splash',
  'kiqr-mailpit': 'Mail',
};

const PILL: Record<AgentStatusKind, {label: string; className: string}> = {
  running: {label: 'Running', className: 'pill pill-running'},
  stopped: {label: 'Stopped', className: 'pill pill-stopped'},
  'docker-down': {label: 'Docker not running', className: 'pill pill-warning'},
};

interface AgentBarProps {
  status: AgentStatus | null;
}

/**
 * The shared "Kiqr agent" — the proxy, splash and mail catcher every site uses.
 * Includes a one-click "Open mail inbox" and start/stop/restart controls.
 */
export function AgentBar({status}: AgentBarProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const kind = status?.kind ?? 'stopped';
  const pill = PILL[kind];
  const dockerDown = kind === 'docker-down';
  const running = status?.running ?? false;

  async function act(action: LifecycleAction): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await window.kiqr.agentAction(action);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="agent-bar">
      <div className="agent-head">
        <div className="agent-id">
          <h2 className="section-title">Kiqr agent</h2>
          <span className="agent-sub">Shared proxy, splash &amp; mail catcher</span>
        </div>

        <div className="agent-right">
          <div className={pill.className} title={status?.message ?? ''}>
            <span className="pill-dot" />
            <span className="pill-label">{pill.label}</span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.kiqr.openUrl(MAIL_INBOX_URL)}
            disabled={!running}
            title="See every email your sites have sent"
          >
            Open mail inbox
          </button>
          {running ? (
            <button
              type="button"
              className="btn"
              onClick={() => act('down')}
              disabled={busy}
            >
              {busy ? 'Working…' : 'Stop'}
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => act('up')}
              disabled={busy || dockerDown}
            >
              {busy ? 'Working…' : 'Start'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => act('restart')}
            disabled={busy || !running}
          >
            Restart
          </button>
        </div>
      </div>

      <div className="agent-services">
        {dockerDown ? (
          <span className="agent-note">
            Start Docker Desktop to bring the agent online.
          </span>
        ) : (
          (status?.containers ?? []).map((container) => (
            <ServiceBadge
              key={container.name}
              label={AGENT_LABELS[container.name] ?? container.name}
              running={container.running}
            />
          ))
        )}
      </div>
    </section>
  );
}
