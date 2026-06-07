import type {ClassifiedStat} from '../../../main/types';
import {Meter} from './Meter';
import {Sparkline} from './Sparkline';

const SERVICE_LABELS: Record<string, string> = {
  traefik: 'Traefik proxy',
  splash: 'Splash page',
  wordpress: 'WordPress',
  mariadb: 'MariaDB',
  mysql: 'MySQL',
  phpmyadmin: 'phpMyAdmin',
  redis: 'Redis',
  container: 'Container',
};

const SERVICE_EMOJI: Record<string, string> = {
  traefik: '🛰️',
  splash: '✨',
  wordpress: '🅦',
  mariadb: '🗄️',
  mysql: '🗄️',
  phpmyadmin: '🛠️',
  redis: '⚡',
  container: '📦',
};

interface ContainerCardProps {
  stat: ClassifiedStat;
  history: number[];
}

export function ContainerCard({stat, history}: ContainerCardProps): JSX.Element {
  const label = SERVICE_LABELS[stat.service] ?? stat.service;
  const emoji = SERVICE_EMOJI[stat.service] ?? '📦';

  return (
    <div className="container-card">
      <div className="container-head">
        <div className="container-title">
          <span className="container-emoji" aria-hidden="true">
            {emoji}
          </span>
          <div>
            <div className="container-name">{label}</div>
            <div className="container-sub">{stat.name}</div>
          </div>
        </div>
        <Sparkline points={history} />
      </div>
      <Meter label="CPU" value={stat.cpu} display={stat.cpuPerc} tone="cpu" />
      <Meter
        label="Memory"
        value={stat.mem}
        display={stat.memUsage || stat.memPerc}
        tone="mem"
      />
    </div>
  );
}
