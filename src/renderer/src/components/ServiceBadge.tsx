interface ServiceBadgeProps {
  label: string;
  running: boolean;
}

/**
 * A small status pill for one dependency, e.g. "● WordPress running".
 * Green dot = running, grey = stopped. Plain language only.
 */
export function ServiceBadge({label, running}: ServiceBadgeProps): JSX.Element {
  return (
    <span className={`svc-badge ${running ? 'svc-up' : 'svc-down'}`}>
      <span className="svc-dot" aria-hidden="true" />
      <span className="svc-label">{label}</span>
      <span className="svc-state">{running ? 'running' : 'stopped'}</span>
    </span>
  );
}
