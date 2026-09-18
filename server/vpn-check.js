const vpnCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function isPrivateIp(ip) {
  return !ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') ||
    ip.startsWith('10.') || ip.startsWith('172.16.') || ip.startsWith('::ffff:127.');
}

// Более агрессивная проверка: помимо явного флага "proxy"/"vpn" от сервисов,
// смотрим на название провайдера/ASN — большинство коммерческих VPN и
// прокси арендуют серверы у известных хостеров, так что по имени организации
// их тоже можно поймать, даже если сам сервис не пометил IP как прокси.
const HOSTING_KEYWORDS = [
  'vpn', 'proxy', 'hosting', 'datacenter', 'data center', 'cloud', 'server',
  'colo', 'digitalocean', 'ovh', 'hetzner', 'amazon', 'aws', 'azure',
  'google cloud', 'linode', 'vultr', 'leaseweb', 'choopa', 'm247', 'contabo',
  'packet', 'scaleway', 'oracle cloud', 'tor exit', 'nordvpn', 'expressvpn',
  'surfshark', 'private internet access', 'protonvpn', 'mullvad', 'cyberghost',
  'ipvanish', 'windscribe',
];
function looksLikeHosting(text) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  return HOSTING_KEYWORDS.some(k => t.includes(k));
}

async function fetchJson(url, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error('bad status');
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function checkProxycheck(ip) {
  const data = await fetchJson(`https://proxycheck.io/v2/${ip}?vpn=1&asn=1`);
  const entry = data?.[ip];
  if (!entry) return null;
  return entry.proxy === 'yes' || looksLikeHosting(entry.provider) || looksLikeHosting(entry.organisation);
}

async function checkIpApi(ip) {
  const data = await fetchJson(`http://ip-api.com/json/${ip}?fields=proxy,hosting,isp,org,as,status`);
  if (data?.status !== 'success') return null;
  return !!(data.proxy || data.hosting || looksLikeHosting(data.isp) || looksLikeHosting(data.org) || looksLikeHosting(data.as));
}

async function isVpnOrProxy(ip) {
  if (isPrivateIp(ip)) return false;

  const cached = vpnCache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.result;

  let result = null;
  const errors = [];
  for (const check of [checkProxycheck, checkIpApi]) {
    try {
      result = await check(ip);
      if (result !== null) break;
    } catch (e) { errors.push(`${check.name}: ${e.message}`); }
  }
  if (result === null) {
    if (errors.length) console.error(`VPN-детект недоступен для ${ip} — ${errors.join('; ')}`);
    result = false; // оба сервиса недоступны — не блокируем пользователя
  }

  vpnCache.set(ip, { result, ts: Date.now() });
  return result;
}

module.exports = { isVpnOrProxy };
