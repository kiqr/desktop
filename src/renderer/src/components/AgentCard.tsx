import type {AgentStatus, ClassifiedStat} from '../../../main/types';
import {useCpuHistory} from '../useCpuHistory';
import {ContainerCard} from './ContainerCard';

interface AgentCardProps {
  status: AgentStatus | null;
  stats: ClassifiedStat[];
}

export function AgentCard({status, stats}: AgentCardProps): JSX.Element {
  const history = useCpuHistory(stats);
  const dockerDown = status?.kind === 'docker-down';
  const hasStats = stats.length > 0;

  return (
    <section className="card agent-card">
      <div className="card-head">
        <h2 className="card-title">Agent</h2>
        <span className="card-subtitle">kiqr-traefik · kiqr-splash</span>
      </div>

      {dockerDown ? (
        <EmptyState
          icon="🐳"
          title="Docker isn't running"
          hint="Start Docker Desktop, then the agent will appear here."
        />
      ) : hasStats ? (
        <div className="container-grid">
          {stats.map((stat) => (
            <ContainerCard
              key={stat.name}
              stat={stat}
              history={history[stat.name] ?? []}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="💤"
          title="Agent stopped"
          hint="Run `kiqr up` or `kiqr agent start` to bring the proxy online."
        />
      )}
    </section>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: string;
  title: string;
  hint: string;
}): JSX.Element {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="empty-title">{title}</div>
      <code className="empty-hint">{hint}</code>
    </div>
  );
}
