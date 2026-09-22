import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
export function readCredentials(env: NodeJS.ProcessEnv = process.env): { apiKey?: string; source: string; configPath: string } {
  const configPath = env.JEV_CHECKPOINT_CONFIG || join(homedir(), '.config', 'jev-checkpoint', 'credentials.json');
  const key = env.JEV_API_KEY?.trim();
  if (key) return { apiKey: key, source: 'environment', configPath };
  const pluginKey = env.JEV_CHECKPOINT_PLUGIN_KEY?.trim();
  if (pluginKey) return { apiKey: pluginKey, source: 'plugin', configPath };
  try {
    if (statSync(configPath).size > 16384) throw Error('Invalid configuration');
    const config: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
    if (!config || typeof config !== 'object' || !('apiKey' in config) || typeof config.apiKey !== 'string' || !config.apiKey.trim())
      throw Error('Invalid configuration');
    return { apiKey: config.apiKey.trim(), source: 'file', configPath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { source: 'missing', configPath };
    throw Error('Invalid credential configuration. Re-run the local configure helper.');
  }
}
