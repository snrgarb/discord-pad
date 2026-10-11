'use strict';

// Hosts the app window is allowed to navigate to and grant permissions for.
const DISCORD_HOSTS = ['discord.com', 'discordapp.com', 'discord.gg', 'discord.new'];

function isDiscordUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return DISCORD_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

// Discord serves a degraded page to unknown browsers; present as plain Chrome.
function chromeUserAgent(ua) {
  return ua.replace(/\s(Electron|discord-pad)\/\S+/gi, '');
}

module.exports = { DISCORD_HOSTS, isDiscordUrl, chromeUserAgent };
