'use strict';

// Launches Electron against the fake Discord page with the smoke driver enabled.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const electron = require('electron');

const root = path.join(__dirname, '..', '..');
const fixture = pathToFileURL(path.join(__dirname, 'fake-discord.html')).href;
const args = [root];
if (process.platform === 'linux') args.push('--no-sandbox');

const result = spawnSync(electron, args, {
  stdio: 'inherit',
  env: { ...process.env, DISCORD_PAD_URL: fixture, DISCORD_PAD_SMOKE: '1' },
  timeout: 120000,
});
process.exit(result.status ?? 1);
