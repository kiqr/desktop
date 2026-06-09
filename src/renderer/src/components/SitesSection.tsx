import type {SiteStatus} from '../../../main/types';
import {SiteCard} from './SiteCard';

interface SitesSectionProps {
  sites: SiteStatus[];
}

/** The primary view: every local kiqr site, grouped one card per project. */
export function SitesSection({sites}: SitesSectionProps): JSX.Element {
  const runningCount = sites.filter((s) => s.running).length;

  return (
    <section className="sites">
      <div className="section-head">
        <h2 className="section-title">Sites</h2>
        <span className="section-meta">
          {sites.length === 0 ? 'none yet' : `${runningCount} of ${sites.length} running`}
        </span>
      </div>

      {sites.length === 0 ? (
        <div className="empty">
          <p className="empty-title">No sites yet</p>
          <p className="empty-sub">
            Run <code>kiqr up</code> inside a WordPress theme to create your first one —
            it'll show up here.
          </p>
        </div>
      ) : (
        <div className="site-list">
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      )}
    </section>
  );
}
