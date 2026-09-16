const ONLINE_WINDOW_MS = 3 * 60 * 1000;
const lastSeen = new Map();

function markOnline(user) {
  if (!user) return;
  lastSeen.set(user.id, { ts: Date.now(), name: user.name, email: user.email, role: user.role });
}

function getOnlineUsers() {
  const now = Date.now();
  const result = [];
  for (const [id, info] of lastSeen) {
    if (now - info.ts < ONLINE_WINDOW_MS) {
      result.push({ id, name: info.name, email: info.email, role: info.role });
    } else {
      lastSeen.delete(id);
    }
  }
  return result;
}

module.exports = { markOnline, getOnlineUsers };
