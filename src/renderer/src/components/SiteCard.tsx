import {useState} from 'react';
import type {SiteStatus} from '../../../main/types';
import type {LifecycleAction} from '../../../preload';
import {ServiceBadge} from './ServiceBadge';

interface SiteCardProps {
  site: SiteStatus;
}

/**
 * One site (project): friendly name, clickable domain, dependency badges, and
 * Open / Start-Stop / Restart controls. No UUIDs anywhere.
 */
export function SiteCard({site}: SiteCardProps): JSX.Element {
  const [busy, setBusy] = useState(false);

  async function act(action: LifecycleAction): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await window.kiqr.siteAction(site.id, action);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`site-card ${site.running ? 'is-running' : 'is-stopped'}`}>
      <div className="site-head">
        <div className="site-id">
          <span className="site-name">{site.name}</span>
          <button
            type="button"
            className="site-domain"
            onClick={() => window.kiqr.openUrl(site.url)}
            disabled={!site.running}
            title={site.running ? `Open ${site.url}` : 'Start the site to open it'}
          >
            {site.domain}
          </button>
        </div>

        <div className="site-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => window.kiqr.openUrl(site.url)}
            disabled={!site.running}
          >
            Open
          </button>
          {site.running ? (
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
              className="btn btn-primary"
              onClick={() => act('up')}
              disabled={busy}
            >
              {busy ? 'Working…' : 'Start'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => act('restart')}
            disabled={busy || !site.running}
          >
            Restart
          </button>
        </div>
      </div>

      <div className="site-services">
        {site.services.map((svc) => (
          <ServiceBadge key={svc.key} label={svc.label} running={svc.running} />
        ))}
      </div>
    </article>
  );
}
