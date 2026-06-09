import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

/**
 * Lifecycle actions the user can drive from the dashboard. Command building is
 * kept pure (and unit-tested); the spawn layer uses `execFile` with an argv
 * array — never a shell string — so paths with spaces can't break or inject.
 */

export type ComposeAction = 'up' | 'down' | 'restart';

/** Build the `docker` argv for a compose lifecycle action on a compose file. */
export function composeArgs(composePath: string, action: ComposeAction): string[] {
  const base = ['compose', '-f', composePath];
  switch (action) {
    case 'up':
      return [...base, 'up', '-d'];
    case 'down':
      return [...base, 'down'];
    case 'restart':
      return [...base, 'restart'];
  }
}

/** Build the `docker` argv to (idempotently) create the shared kiqr network. */
export function networkCreateArgs(name = 'kiqr'): string[] {
  return ['network', 'create', name];
}

export type RunDocker = (args: string[]) => Promise<void>;

const execFileAsync = promisify(execFile);

/** Default runner: `docker <args>` with no shell. */
export const runDocker: RunDocker = async (args) => {
  await execFileAsync('docker', args, {
    timeout: 120_000,
    maxBuffer: 1024 * 1024 * 8,
  });
};

/** Start a site's containers (`docker compose -f <file> up -d`). */
export async function startSite(
  composePath: string,
  run: RunDocker = runDocker,
): Promise<void> {
  // The site joins the external `kiqr` network; make sure it exists first.
  await run(networkCreateArgs()).catch(() => {});
  await run(composeArgs(composePath, 'up'));
}

/** Stop a site's containers (`docker compose -f <file> down`). */
export async function stopSite(
  composePath: string,
  run: RunDocker = runDocker,
): Promise<void> {
  await run(composeArgs(composePath, 'down'));
}

/** Restart a site's containers. */
export async function restartSite(
  composePath: string,
  run: RunDocker = runDocker,
): Promise<void> {
  await run(composeArgs(composePath, 'restart'));
}

/** Start / stop / restart the shared kiqr agent (proxy + splash + mail). */
export async function agentAction(
  composePath: string,
  action: ComposeAction,
  run: RunDocker = runDocker,
): Promise<void> {
  if (action === 'up') await run(networkCreateArgs()).catch(() => {});
  await run(composeArgs(composePath, action));
}
