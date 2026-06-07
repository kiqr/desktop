import {useMemo} from 'react';
import type {AgentStatus, ClassifiedStat} from '../../../main/types';
import {useCpuHistory} from '../useCpuHistory';
import {ContainerCard} from './ContainerCard';

interface ProjectsSectionProps {
  status: AgentStatus | null;
  stats: ClassifiedStat[];
}

export function ProjectsSection({status, stats}: ProjectsSectionProps): JSX.Element {
  const history = useCpuHistory(stats);

  // Group project containers by their derived project slug.
  const groups = useMemo(() => {
    const map = new Map<string, ClassifiedStat[]>();
    for (const stat of stats) {
      const key = stat.project ?? stat.name;
      const list = map.get(key) ?? [];
      list.push(stat);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [stats]);

  const dockerDown = status?.kind === 'docker-down';

  return (
    <section className="card projects-card">
      <div className="card-head">
        <h2 className="card-title">Projects</h2>
        <span className="card-subtitle">
          {groups.length > 0
            ? `${groups.length} environment${groups.length === 1 ? '' : 's'} running`
            : 'WordPress · MariaDB · phpMyAdmin'}
        </span>
      </div>

      {groups.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">
            {dockerDown ? '🐳' : '🌱'}
          </span>
          <div className="empty-title">
            {dockerDown ? 'Waiting on Docker' : 'No projects running'}
          </div>
          <code className="empty-hint">cd your-theme &amp;&amp; kiqr up</code>
        </div>
      ) : (
        <div className="project-list">
          {groups.map(([project, containers]) => (
            <div key={project} className="project-group">
              <div className="project-name">
                <span className="project-bullet" aria-hidden="true" />
                {project}
              </div>
              <div className="container-grid">
                {containers.map((stat) => (
                  <ContainerCard
                    key={stat.name}
                    stat={stat}
                    history={history[stat.name] ?? []}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
