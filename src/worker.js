import QRCode from 'qrcode-svg';

// Thứ tự phải trùng với các ô trên bánh quay trong public/index.html.
const PRIZES = [
  { name: 'Ăn miễn phí 2 tô phở / 1 tuần', special: true },
  { name: '1 Tô Phở Miễn Phí 50K', special: true },
  { name: 'Giảm giá 5K', special: false },
  { name: '1 Chai Sữa Tươi Mát Lạnh', special: false },
  { name: '1 Ly Trà Gừng Mát Lạnh', special: false },
  { name: 'Chúc Bạn May Mắn Lần Sau', special: false }
];

const BASE_CYCLE_SIZE = 600;
const BASE_REGULAR_QUOTAS = { 2: 6, 3: 4, 4: 25 };
const MAX_CYCLE_SIZE = 1000000;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache', ...extraHeaders } });
}
function clearAdminCookie() {
  return 'anna_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}
function adminCookie(token, maxAge = 2592000) {
  return `anna_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function readCookie(req, name) {
  const raw = req.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) {
      try { return decodeURIComponent(rest.join('=')); } catch { return rest.join('='); }
    }
  }
  return '';
}
function normPhone(v) { return String(v || '').replace(/\D/g, ''); }
function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()); }
function tokenCode(prefix = 'ANNA') { return prefix + '-' + crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase(); }
function randomHex(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map(x => x.toString(16).padStart(2, '0')).join('');
}
function makeQrDataUrl(text) {
  const svg = new QRCode({ content: text, padding: 4, width: 360, height: 360, color: '#000000', background: '#ffffff', ecl: 'H' }).svg();
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
async function sha256(text) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function hashPassword(password, saltHex) {
  // D1-only admin: salted SHA-256, lightweight enough for Cloudflare Workers.
  return await sha256(saltHex + ':' + String(password));
}
async function ensureAdminTables(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_credentials (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at)').run();
}
async function getAdminAccount(env) {
  await ensureAdminTables(env);
  return await env.DB.prepare('SELECT id,password_hash,salt,token_hash FROM admin_credentials WHERE id=1').first();
}
async function createAdminSession(env) {
  await ensureAdminTables(env);
  const raw = randomHex(32);
  const hash = await sha256(raw);
  const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').bind(Date.now()).run();
  await env.DB.prepare('INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,?)').bind(hash,expires).run();
  return {raw,hash,expires};
}
async function adminSessionOk(env, rawToken) {
  if (!rawToken) return false;
  await ensureAdminTables(env);
  const hash = await sha256(rawToken);
  const row = await env.DB.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash=?').bind(hash).first();
  if (!row) return false;
  if (Number(row.expires_at)<=Date.now()) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(hash).run();
    return false;
  }
  return true;
}

async function createAdminAccount(env, password) {
  const p = String(password || '').trim();
  if (p.length < 8 || p.length > 128) return { ok:false, error:'Mật khẩu phải từ 8 đến 128 ký tự.' };
  const existing = await getAdminAccount(env);
  if (existing) return { ok:false, error:'Tài khoản quản trị đã được khởi tạo.' };
  const salt = randomHex(16);
  const passwordHash = await hashPassword(p, salt);
  const tokenHash = await sha256(p);
  const r = await env.DB.prepare(
    "INSERT OR IGNORE INTO admin_credentials(id,password_hash,salt,token_hash,updated_at) VALUES(1,?,?,?,datetime('now'))"
  ).bind(passwordHash, salt, tokenHash).run();
  if (r.meta.changes !== 1) return { ok:false, error:'Không thể khởi tạo tài khoản quản trị.' };
  return { ok:true, token:tokenHash };
}

async function adminOk(req, env) {
  const account = await getAdminAccount(env);
  if (!account) return false;
  const cookieToken = readCookie(req, 'anna_admin');
  const headerToken = req.headers.get('X-Admin-Token') || '';
  // IMPORTANT: try cookie and header independently. A stale cookie must not
  // mask a valid localStorage token after F5.
  if (cookieToken && await adminSessionOk(env, cookieToken)) return true;
  if (headerToken && headerToken !== cookieToken && await adminSessionOk(env, headerToken)) return true;
  // Legacy compatibility with older pages that stored sha256(password).
  return !!((cookieToken && cookieToken === account.token_hash) || (headerToken && headerToken === account.token_hash));
}
async function ensurePlayColumns(env) {
  const info = await env.DB.prepare('PRAGMA table_info(plays)').all();
  const cols = new Set((info.results || []).map(x => String(x.name)));
  const adds = [];
  if (!cols.has('redemption_count')) adds.push("ALTER TABLE plays ADD COLUMN redemption_count INTEGER NOT NULL DEFAULT 0");
  if (!cols.has('expires_at')) adds.push("ALTER TABLE plays ADD COLUMN expires_at TEXT");
  if (!cols.has('cycle600_no')) adds.push("ALTER TABLE plays ADD COLUMN cycle600_no INTEGER NOT NULL DEFAULT 1");
  if (!cols.has('cycle600_position')) adds.push("ALTER TABLE plays ADD COLUMN cycle600_position INTEGER");
  for (const sql of adds) await env.DB.prepare(sql).run();
}

async function ensureDailyConfig(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS daily_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_daily INTEGER NOT NULL DEFAULT 4,
    free_daily INTEGER NOT NULL DEFAULT 2,
    task_daily INTEGER NOT NULL DEFAULT 2,
    task_enabled INTEGER NOT NULL DEFAULT 1,
    task_label TEXT NOT NULL DEFAULT 'Mời bạn cùng ăn tại PHỞ NHÀ ANNA',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  await env.DB.prepare(`INSERT OR IGNORE INTO daily_config(id,total_daily,free_daily,task_daily,task_enabled,task_label) VALUES(1,4,2,2,1,'Mời bạn cùng ăn tại PHỞ NHÀ ANNA')`).run();
}
async function getDailyConfig(env) {
  await ensureDailyConfig(env);
  return await env.DB.prepare('SELECT total_daily,free_daily,task_daily,task_enabled,task_label,updated_at FROM daily_config WHERE id=1').first();
}

async function ensureCycleConfig(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS cycle_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    cycle_size INTEGER NOT NULL DEFAULT 600,
    pending_cycle_size INTEGER,
    quota_prize0 INTEGER NOT NULL DEFAULT 1,
    quota_prize1 INTEGER NOT NULL DEFAULT 1,
    quota_prize2 INTEGER NOT NULL DEFAULT 6,
    quota_prize3 INTEGER NOT NULL DEFAULT 4,
    quota_prize4 INTEGER NOT NULL DEFAULT 25,
    pending_quota_prize0 INTEGER,
    pending_quota_prize1 INTEGER,
    pending_quota_prize2 INTEGER,
    pending_quota_prize3 INTEGER,
    pending_quota_prize4 INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  const info = await env.DB.prepare('PRAGMA table_info(cycle_config)').all();
  const cols = new Set((info.results || []).map(x => String(x.name)));
  const adds = [
    ['quota_prize0', 'ALTER TABLE cycle_config ADD COLUMN quota_prize0 INTEGER NOT NULL DEFAULT 1'],
    ['quota_prize1', 'ALTER TABLE cycle_config ADD COLUMN quota_prize1 INTEGER NOT NULL DEFAULT 1'],
    ['quota_prize2', 'ALTER TABLE cycle_config ADD COLUMN quota_prize2 INTEGER NOT NULL DEFAULT 6'],
    ['quota_prize3', 'ALTER TABLE cycle_config ADD COLUMN quota_prize3 INTEGER NOT NULL DEFAULT 4'],
    ['quota_prize4', 'ALTER TABLE cycle_config ADD COLUMN quota_prize4 INTEGER NOT NULL DEFAULT 25'],
    ['pending_quota_prize0', 'ALTER TABLE cycle_config ADD COLUMN pending_quota_prize0 INTEGER'],
    ['pending_quota_prize1', 'ALTER TABLE cycle_config ADD COLUMN pending_quota_prize1 INTEGER'],
    ['pending_quota_prize2', 'ALTER TABLE cycle_config ADD COLUMN pending_quota_prize2 INTEGER'],
    ['pending_quota_prize3', 'ALTER TABLE cycle_config ADD COLUMN pending_quota_prize3 INTEGER'],
    ['pending_quota_prize4', 'ALTER TABLE cycle_config ADD COLUMN pending_quota_prize4 INTEGER']
  ];
  for (const [name,sql] of adds) if (!cols.has(name)) await env.DB.prepare(sql).run();
  await env.DB.prepare(`INSERT OR IGNORE INTO cycle_config(
    id,cycle_size,pending_cycle_size,quota_prize0,quota_prize1,quota_prize2,quota_prize3,quota_prize4,
    pending_quota_prize0,pending_quota_prize1,pending_quota_prize2,pending_quota_prize3,pending_quota_prize4
  ) VALUES(1,600,NULL,1,1,6,4,25,NULL,NULL,NULL,NULL,NULL)`).run();
}

async function getCycleConfig(env) {
  await ensureCycleConfig(env);
  return await env.DB.prepare(`SELECT cycle_size,pending_cycle_size,
    quota_prize0,quota_prize1,quota_prize2,quota_prize3,quota_prize4,
    pending_quota_prize0,pending_quota_prize1,pending_quota_prize2,pending_quota_prize3,pending_quota_prize4,
    updated_at FROM cycle_config WHERE id=1`).first();
}

function quotaObject(row, pending=false) {
  const pre = pending ? 'pending_' : '';
  return {
    0: Number(row?.[pre+'quota_prize0'] ?? 1),
    1: Number(row?.[pre+'quota_prize1'] ?? 1),
    2: Number(row?.[pre+'quota_prize2'] ?? 6),
    3: Number(row?.[pre+'quota_prize3'] ?? 4),
    4: Number(row?.[pre+'quota_prize4'] ?? 25)
  };
}

function validateQuotas(size, quotas) {
  const q = {};
  for (const i of [0,1,2,3,4]) {
    const n = Number(quotas?.[i] ?? 0);
    if (!Number.isInteger(n) || n < 0) return {ok:false,error:'Số lượng từng giải phải là số nguyên không âm.'};
    q[i] = n;
  }
  const total = Object.values(q).reduce((a,b)=>a+b,0);
  if (total > size) return {ok:false,error:`Tổng số giải (${total}) không được lớn hơn số lượt/chu kỳ (${size}).`};
  return {ok:true,quotas:q,consolation:size-total};
}

function quotaPositions(count, size, startRatio, endRatio, preferLast=false, occupied=new Set()) {
  if (count <= 0) return [];
  const start = Math.max(1, Math.round(size * startRatio));
  const end = Math.max(start, Math.min(size, Math.round(size * endRatio)));
  const out=[];
  const reserveLast = preferLast && end===size;
  const normalCount = reserveLast ? Math.max(0,count-1) : count;
  for(let k=1;k<=normalCount;k++) {
    let ideal = Math.round(start + (end-start) * (k/(normalCount+1)));
    ideal=Math.max(start,Math.min(end,ideal));
    let pos=ideal;
    if(occupied.has(pos)) {
      let found=0;
      for(let d=1; d<=Math.max(end-start+1,size); d++) {
        const a=ideal-d, b=ideal+d;
        if(a>=start && !occupied.has(a)){found=a;break;}
        if(b<=end && !occupied.has(b)){found=b;break;}
      }
      if(!found) continue;
      pos=found;
    }
    occupied.add(pos); out.push(pos);
  }
  if(reserveLast && out.length<count && !occupied.has(size)){occupied.add(size);out.push(size);}
  return out;
}

function specialSchedule(cycleNo, cycleSize, quotas) {
  const q50 = Number(quotas?.[1]||0), q2 = Number(quotas?.[0]||0), size=Math.max(1,Number(cycleSize));
  const occupied=new Set();
  const p50 = Number(cycleNo)===1
    ? quotaPositions(q50,size,0.10,0.22,false,occupied)
    : quotaPositions(q50,size,0.45,0.59,false,occupied);
  const p2 = Number(cycleNo)===1
    ? quotaPositions(q2,size,0.20,0.30,false,occupied)
    : quotaPositions(q2,size,0.95,1.00,true,occupied);
  return {1:p50,0:p2};
}

// Build one deterministic prize map for the whole cycle. Regular prizes are
// spread across the positions not reserved for special prizes; all remaining
// positions are consolation. This prevents consecutive early wins caused by
// selecting a regular prize on every non-special spin.
function buildPrizeSchedule(cycleNo, size, quotas) {
  const n=Math.max(1,Number(size));
  const specials=specialSchedule(cycleNo,n,quotas);
  const map=new Map();
  for(const idx of [0,1]) for(const p of (specials[idx]||[])) if(p>=1&&p<=n&&!map.has(p)) map.set(p,idx);
  const available=[];
  for(let p=1;p<=n;p++) if(!map.has(p)) available.push(p);
  const regular=[2,3,4];
  const totalRegular=regular.reduce((s,i)=>s+Math.max(0,Number(quotas?.[i]||0)),0);
  if(totalRegular>0 && available.length){
    const assigned={2:0,3:0,4:0}; let assignedTotal=0;
    for(let j=1;j<=available.length;j++){
      const targetTotal=Math.min(totalRegular,Math.round(j*totalRegular/available.length));
      if(targetTotal<=assignedTotal) continue;
      let best=null;
      for(const i of regular){
        const q=Math.max(0,Number(quotas?.[i]||0));
        if(assigned[i]>=q) continue;
        const ideal=j*q/available.length;
        const deficit=ideal-assigned[i];
        if(!best || deficit>best.deficit || (deficit===best.deficit&&i<best.i)) best={i,deficit};
      }
      if(best){map.set(available[j-1],best.i);assigned[best.i]++;assignedTotal++;}
    }
  }
  return map;
}

function chooseScheduledPrize(schedule, counts, quotas, position, size) {
  const wanted=schedule.get(Number(position));
  if(wanted!==undefined && wanted!==5 && Number(counts[wanted]||0)<Number(quotas?.[wanted]||0)) return wanted;
  return 5;
}

async function ensureCycleState(env) {
  // Bộ đếm riêng cho chu kỳ động: không giới hạn 300/600, hỗ trợ mọi cycle_size hợp lệ.
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS cycle_state_dynamic (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    cycle_no INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  await env.DB.prepare("INSERT OR IGNORE INTO cycle_state_dynamic(id,cycle_no,position) VALUES(1,1,0)").run();
}


async function ensureUnlockTables(env) {
  // Repair/extend old D1 schemas as well as creating new tables. Existing rows
  // are preserved. Older versions did not always have token/created_at fields.
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS customer_unlocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    unlock_type INTEGER NOT NULL,
    unlock_date TEXT NOT NULL,
    token TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(customer_id, unlock_type, unlock_date)
  )`).run();
  const info=await env.DB.prepare('PRAGMA table_info(customer_unlocks)').all();
  const cols=new Set((info.results||[]).map(x=>String(x.name)));
  if(!cols.has('token')) await env.DB.prepare('ALTER TABLE customer_unlocks ADD COLUMN token TEXT').run();
  if(!cols.has('created_at')) await env.DB.prepare("ALTER TABLE customer_unlocks ADD COLUMN created_at TEXT").run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS unlock_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    phone TEXT,
    unlock_type INTEGER NOT NULL,
    token TEXT UNIQUE,
    expires_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    used_at TEXT
  )`).run();
  const info2=await env.DB.prepare('PRAGMA table_info(unlock_tokens)').all();
  const cols2=new Set((info2.results||[]).map(x=>String(x.name)));
  const adds2=[
    ['customer_id','ALTER TABLE unlock_tokens ADD COLUMN customer_id INTEGER'],
    ['phone','ALTER TABLE unlock_tokens ADD COLUMN phone TEXT'],
    ['unlock_type', 'ALTER TABLE unlock_tokens ADD COLUMN unlock_type INTEGER'],
    ['token','ALTER TABLE unlock_tokens ADD COLUMN token TEXT'],
    ['expires_at','ALTER TABLE unlock_tokens ADD COLUMN expires_at TEXT'],
    ['status',"ALTER TABLE unlock_tokens ADD COLUMN status TEXT DEFAULT 'active'"],
    ['created_at','ALTER TABLE unlock_tokens ADD COLUMN created_at TEXT'],
    ['used_at','ALTER TABLE unlock_tokens ADD COLUMN used_at TEXT']
  ];
  for(const [name,sql] of adds2) if(!cols2.has(name)) await env.DB.prepare(sql).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_customer_unlocks_lookup ON customer_unlocks(customer_id, unlock_date)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_unlock_tokens_token ON unlock_tokens(token)').run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_extra_unlocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    unlock_date TEXT NOT NULL,
    token TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(customer_id, unlock_date)
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_admin_extra_unlocks_lookup ON admin_extra_unlocks(customer_id, unlock_date)').run();
}

async function customerUnlocks(env, customerId, date) {
  const rows = await env.DB.prepare('SELECT unlock_type FROM customer_unlocks WHERE customer_id=? AND unlock_date=?').bind(customerId,date).all();
  const extra = await env.DB.prepare('SELECT id FROM admin_extra_unlocks WHERE customer_id=? AND unlock_date=?').bind(customerId,date).first();
  const types = new Set((rows.results || []).map(r => Number(r.unlock_type)));
  return { inviteUnlock: types.has(4) || !!extra, unlock2: types.has(2), unlock3: types.has(3) };
}

function specialExpires(prizeIndex, date) {
  if (prizeIndex === 0) return new Date(Date.now() + 7 * 86400000).toISOString();
  if (prizeIndex === 1) return new Date(Date.now() + 2 * 86400000).toISOString();
  if ([2,3,4].includes(prizeIndex)) return new Date(Date.now() + 1 * 86400000).toISOString();
  return null;
}

async function syncCycleState(env) {
  await ensurePlayColumns(env);
  await ensureCycleState(env);
  const state = await env.DB.prepare('SELECT cycle_no,position FROM cycle_state_dynamic WHERE id=1').first();
  if (!state) return null;
  const config = await getCycleConfig(env);
  const maxRow = await env.DB.prepare('SELECT MAX(cycle600_no) AS cycle_no, MAX(cycle600_position) AS position FROM plays WHERE cycle600_no=(SELECT MAX(cycle600_no) FROM plays)').first();
  const maxCycle = Number(maxRow?.cycle_no || 0);
  const maxPosition = Number(maxRow?.position || 0);
  let cycleNo = Number(state.cycle_no || 1);
  let position = Number(state.position || 0);
  if (maxCycle > cycleNo || (maxCycle === cycleNo && maxPosition > position)) {
    cycleNo = maxCycle;
    position = maxPosition;
    await env.DB.prepare("UPDATE cycle_state_dynamic SET cycle_no=?,position=?,updated_at=datetime('now') WHERE id=1").bind(cycleNo,position).run();
  }
  return {cycleNo,position,cycleSize:Number(config?.cycle_size||BASE_CYCLE_SIZE),pendingCycleSize:config?.pending_cycle_size?Number(config.pending_cycle_size):null,quotas:quotaObject(config),pendingQuotas:quotaObject(config,true)};
}

async function reserveCyclePosition(env) {
  await syncCycleState(env);
  // Atomic counter update. If the current cycle is complete, the pending size becomes active for the new cycle.
  const result = await env.DB.prepare(`
    UPDATE cycle_state_dynamic
    SET cycle_no = CASE
      WHEN position >= (SELECT cycle_size FROM cycle_config WHERE id=1)
        THEN cycle_no + 1
      ELSE cycle_no
    END,
    position = CASE
      WHEN position >= (SELECT cycle_size FROM cycle_config WHERE id=1)
        THEN 1
      ELSE position + 1
    END,
    updated_at = datetime('now')
    WHERE id=1
    RETURNING cycle_no, position
  `).run();
  const row = result?.results?.[0];
  if (!row) return null;
  const cycleNo = Number(row.cycle_no), position = Number(row.position);
  // Apply pending size only after a new cycle has started.
  const config = await getCycleConfig(env);
  if (position === 1 && cycleNo > 1 && config?.pending_cycle_size) {
    await env.DB.prepare(`UPDATE cycle_config SET
      cycle_size=COALESCE(pending_cycle_size,cycle_size),
      pending_cycle_size=NULL,
      quota_prize0=COALESCE(pending_quota_prize0,quota_prize0),
      quota_prize1=COALESCE(pending_quota_prize1,quota_prize1),
      quota_prize2=COALESCE(pending_quota_prize2,quota_prize2),
      quota_prize3=COALESCE(pending_quota_prize3,quota_prize3),
      quota_prize4=COALESCE(pending_quota_prize4,quota_prize4),
      pending_quota_prize0=NULL,pending_quota_prize1=NULL,pending_quota_prize2=NULL,pending_quota_prize3=NULL,pending_quota_prize4=NULL,
      updated_at=datetime('now') WHERE id=1`).run();
  }
  const fresh = await getCycleConfig(env);
  return {cycle_no:cycleNo, position, cycle_size:Number(fresh?.cycle_size||BASE_CYCLE_SIZE), quotas:quotaObject(fresh)};
}

async function specialHistory(env, customerId) {
  const rows = await env.DB.prepare('SELECT DISTINCT prize_index FROM plays WHERE customer_id=? AND prize_index IN (0,1)').bind(customerId).all();
  const set = new Set((rows.results || []).map(x => Number(x.prize_index)));
  return { has0: set.has(0), has1: set.has(1) };
}


async function ensureSpinLockTable(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS spin_locks (
    lock_key TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_spin_locks_expires ON spin_locks(expires_at)').run();
}

async function acquireSpinLock(env, lockKey) {
  await ensureSpinLockTable(env);
  const now = Date.now();
  // Remove only stale locks. The unique PRIMARY KEY then makes acquisition atomic
  // for concurrent requests using the same customer/day key.
  await env.DB.prepare('DELETE FROM spin_locks WHERE lock_key=? AND expires_at<=?').bind(lockKey, now).run();
  const token = randomHex(16);
  try {
    const r = await env.DB.prepare('INSERT INTO spin_locks(lock_key,token,expires_at) VALUES(?,?,?)').bind(lockKey,token,now+30000).run();
    if (r.meta.changes !== 1) return null;
    return token;
  } catch (e) {
    return null;
  }
}

async function releaseSpinLock(env, lockKey, token) {
  try { await env.DB.prepare('DELETE FROM spin_locks WHERE lock_key=? AND token=?').bind(lockKey,token).run(); } catch(e) {}
}

function isWinningPrize(index) {
  return Number(index) >= 0 && Number(index) <= 4;
}

async function api(req, env, url) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (url.pathname === '/api/daily-config' && req.method === 'GET') {
    const dc=await getDailyConfig(env);
    return json({ok:true,totalDaily:Number(dc?.total_daily||4),freeDaily:Number(dc?.free_daily||2),taskDaily:Number(dc?.task_daily||2),taskEnabled:Number(dc?.task_enabled||0)===1,taskLabel:String(dc?.task_label||'')});
  }

  if (url.pathname === '/api/register' && req.method === 'POST') {
    const b = await req.json(); const name = String(b.name || '').trim(); const phone = normPhone(b.phone);
    if (name.length < 2 || phone.length < 9 || phone.length > 12) return json({ ok:false, error:'Tên hoặc số điện thoại không hợp lệ.' },400);
    await env.DB.prepare("INSERT INTO customers(name,phone) VALUES(?,?) ON CONFLICT(phone) DO UPDATE SET name=excluded.name").bind(name,phone).run();
    const c = await env.DB.prepare('SELECT id,name,phone FROM customers WHERE phone=?').bind(phone).first();
    const d = today(); const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM plays WHERE customer_id=? AND play_date=?').bind(c.id,d).first();
    await ensureUnlockTables(env);
    const unlocks = await customerUnlocks(env,c.id,d); const used = Number(row?.n || 0);
    const dc = await getDailyConfig(env);
    const totalDaily = Math.max(1, Number(dc?.total_daily ?? 4));
    const freeDaily = Math.min(totalDaily, Math.max(0, Number(dc?.free_daily ?? 2)));
    const taskDaily = Math.min(Math.max(0,totalDaily-freeDaily), Math.max(0,Number(dc?.task_daily ?? 2)));
    const taskEnabled = Number(dc?.task_enabled ?? 1) === 1;
    return json({ ok:true, customer:{id:c.id,name:c.name}, used, remaining:Math.max(0,totalDaily-used), totalDaily, freeDaily, taskDaily, taskEnabled, taskLabel:String(dc?.task_label || ''), unlockedExtra:unlocks.inviteUnlock ? taskDaily : 0, ...unlocks });
  }

  if (url.pathname === '/api/spin' && req.method === 'POST') {
    const b = await req.json(); const phone = normPhone(b.phone);
    if (phone.length < 9 || phone.length > 12) return json({ok:false,error:'Số điện thoại không hợp lệ.'},400);
    const c = await env.DB.prepare('SELECT id,name FROM customers WHERE phone=?').bind(phone).first();
    if (!c) return json({ok:false,error:'Khách chưa đăng ký.'},404);
    const d = today();
    // Global lock serializes spins so the cycle counter and the
    // 'no 3 winning spins in a row' rule remain correct even when several
    // customers spin at the same time on different phones.
    const spinLockKey = 'global:spin';
    const spinLockToken = await acquireSpinLock(env, spinLockKey);
    if (!spinLockToken) return json({ok:false,error:'Lượt quay đang được xử lý. Vui lòng chờ một chút rồi thử lại.'},409);
    try {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM plays WHERE customer_id=? AND play_date=?').bind(c.id,d).first();
    const used = Number(row?.n || 0); await ensureUnlockTables(env); const unlocks = await customerUnlocks(env,c.id,d);
    const dc = await getDailyConfig(env);
    const totalDaily = Math.max(1, Number(dc?.total_daily ?? 4));
    const freeDaily = Math.min(totalDaily, Math.max(0, Number(dc?.free_daily ?? 2)));
    const taskDaily = Math.min(Math.max(0,totalDaily-freeDaily), Math.max(0,Number(dc?.task_daily ?? 2)));
    const taskEnabled = Number(dc?.task_enabled ?? 1) === 1;
    if (used >= totalDaily) return json({ok:false,error:`Hôm nay khách đã hết ${totalDaily} lượt quay.`},429);
    if (taskEnabled && used >= freeDaily && taskDaily > 0 && !unlocks.inviteUnlock) return json({ok:false,code:'INVITE_UNLOCK',error:`Khách cần hoàn thành nhiệm vụ để mở thêm ${taskDaily} lượt.`,totalDaily,freeDaily,taskDaily,taskEnabled,taskLabel:String(dc?.task_label||''),...unlocks},403);

    const history = await specialHistory(env,c.id);
    await ensureCycleState(env);
    const reserved = await reserveCyclePosition(env);
    if (!reserved) return json({ok:false,error:'Không thể cấp lượt trong bộ đếm chu kỳ.'},500);
    const cycleNo = Number(reserved.cycle_no), cyclePosition = Number(reserved.position), cycleSize = Number(reserved.cycle_size||BASE_CYCLE_SIZE);

    const rows = await env.DB.prepare('SELECT id,customer_id,prize_index,redeemed FROM plays WHERE cycle600_no=? ORDER BY cycle600_position ASC').bind(cycleNo).all();
    const cycleRows = rows.results || [];
    const counts = [0,0,0,0,0,0];
    for (const r of cycleRows) { const idx=Number(r.prize_index); if(idx>=0&&idx<6) counts[idx]++; }

    const eligibleFor = async (specialIndex) => {
      return !(specialIndex===0 ? history.has1 : history.has0);
    };
    const quotas = reserved.quotas || {0:1,1:1,2:6,3:4,4:25};
    const schedules = specialSchedule(cycleNo, cycleSize, quotas);
    const prizeSchedule = buildPrizeSchedule(cycleNo,cycleSize,quotas);
    const special1Available = !history.has0 && Number(quotas[1]||0)>counts[1];
    const special0Available = !history.has1 && Number(quotas[0]||0)>counts[0];

    let i = chooseScheduledPrize(prizeSchedule,counts,quotas,cyclePosition,cycleSize);
    // If a scheduled special is ineligible, keep this position as a regular/
    // consolation result and let the special be awarded at its next available
    // scheduled position rather than creating a burst of regular prizes.
    if(i===1 && (!special1Available || !(await eligibleFor(1)))) i=5;
    if(i===0 && (!special0Available || !(await eligibleFor(0)))) i=5;
    if(i===5){
      const dueSpecial1=schedules[1].filter(p=>p<=cyclePosition).length-counts[1];
      const dueSpecial0=schedules[0].filter(p=>p<=cyclePosition).length-counts[0];
      if(dueSpecial1>0 && special1Available && await eligibleFor(1)) i=1;
      else if(dueSpecial0>0 && special0Available && await eligibleFor(0)) i=0;
    }

    // Nếu vị trí 600 gặp khách đã có giải đặc biệt còn lại, tìm lượt thường
    // gần nhất trước đó của một khách chưa có giải đặc biệt 50K và đổi giải.
    if (special0Available && schedules[0].includes(cyclePosition) && !await eligibleFor(0)) {
      const prior = await env.DB.prepare(`
        SELECT p.id,p.prize_index,p.customer_id,p.reward_code,p.created_at
        FROM plays p
        WHERE p.cycle600_no=? AND p.cycle600_position<? AND p.prize_index IN (2,3,4,5)
          AND NOT EXISTS (SELECT 1 FROM plays h WHERE h.customer_id=p.customer_id AND h.prize_index=1)
        ORDER BY p.cycle600_position DESC LIMIT 1
      `).bind(cycleNo,cyclePosition).first();
      if (prior) {
        const displacedIndex=Number(prior.prize_index);
        const specialCode=String(prior.reward_code);
        const specialExpiry=specialExpires(0,d);
        await env.DB.prepare('UPDATE plays SET prize_index=0,prize_name=?,expires_at=? WHERE id=?')
          .bind(PRIZES[0].name,specialExpiry,prior.id).run();
        i=displacedIndex;
      } else {
        i=5;
      }
    }

    // Không cho một khách sở hữu cả hai giải đặc biệt.
    if ((i===0 && history.has1) || (i===1 && history.has0)) i = 5;

    // Bảo vệ lỗi '3 lượt liên tiếp đều trúng giải'. Hai lượt thắng liên tiếp
    // ngay trước lượt hiện tại thì lượt này bắt buộc là 'May mắn lần sau'.
    // Kiểm tra ở server nên không thể bị bypass bằng cách mở nhiều tab.
    const lastTwo = await env.DB.prepare(
      'SELECT prize_index FROM plays ORDER BY id DESC LIMIT 2'
    ).all();
    const lastTwoResults = lastTwo.results || [];
    if (lastTwoResults.length === 2 && lastTwoResults.every(r => isWinningPrize(r.prize_index))) i = 5;

    const rewardCode = tokenCode('ANNA'); const p = PRIZES[i]; const expiresAt = specialExpires(i,d);
    await env.DB.prepare(`INSERT INTO plays
      (customer_id,play_date,prize_index,prize_name,reward_code,expires_at,cycle_no,cycle_position,cycle600_no,cycle600_position)
      VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .bind(c.id,d,i,p.name,rewardCode,expiresAt,cycleNo,cyclePosition,cycleNo,cyclePosition).run();
    let qr; try { qr=makeQrDataUrl(rewardCode); } catch(e) { console.error(e); return json({ok:false,error:'Tạo mã QR thất bại.'},500); }
    return json({ok:true,prizeIndex:i,prize:p.name,special:p.special,rewardCode,qr,
      specialTerms:i===0?'Có hiệu lực 7 ngày; tối đa 1 tô/ngày; giá trị tối đa 50.000đ/tô; phần vượt quá khách tự thanh toán.':i===1?'Có hiệu lực 2 ngày; áp dụng cho 1 tô phở tối đa 50.000đ.':i===2?'Có hiệu lực 1 ngày.':i===3?'Có hiệu lực 1 ngày.':i===4?'Có hiệu lực 1 ngày.':'',
      remaining:Math.max(0,totalDaily-(used+1)),totalDaily,freeDaily,taskDaily,taskEnabled,taskLabel:String(dc?.task_label||''),cycleNo,cyclePosition});
    } finally {
      await releaseSpinLock(env, spinLockKey, spinLockToken);
    }
  }

  if (url.pathname === '/api/unlock/claim' && req.method === 'POST') {
    const b=await req.json(); const phone=normPhone(b.phone); const token=String(b.token||'').trim().toUpperCase();
    if(!token||phone.length<9||phone.length>12)return json({ok:false,error:'Vui lòng nhập đúng số điện thoại và mã mở khóa.'},400);
    const c=await env.DB.prepare('SELECT id FROM customers WHERE phone=?').bind(phone).first(); if(!c)return json({ok:false,error:'Không tìm thấy khách hàng.'},404);
    const t=await env.DB.prepare('SELECT id,unlock_type,expires_at,status,customer_id,phone FROM unlock_tokens WHERE token=?').bind(token).first();
    if(!t)return json({ok:false,error:'Mã mở khóa không tồn tại.'},404);
    if(String(t.phone)!==phone || Number(t.customer_id)!==Number(c.id))return json({ok:false,error:'Mã mở khóa không thuộc số điện thoại này.'},403);
    if(t.status!=='issued')return json({ok:false,error:'Mã mở khóa đã được sử dụng.'},409);
    if(new Date(t.expires_at).getTime()<=Date.now()){await env.DB.prepare("UPDATE unlock_tokens SET status='expired' WHERE id=?").bind(t.id).run();return json({ok:false,error:'Mã mở khóa đã hết hạn.'},410);}
    const d=today(); await ensureUnlockTables(env);
    if(Number(t.unlock_type)===4){
      const existing=await env.DB.prepare('SELECT id FROM admin_extra_unlocks WHERE customer_id=? AND unlock_date=?').bind(c.id,d).first();
      if(existing)return json({ok:false,error:'Lượt này đã được mở khóa hôm nay.'},409);
      await env.DB.batch([
        env.DB.prepare("INSERT INTO admin_extra_unlocks(customer_id,unlock_date,token,created_at) VALUES(?,?,?,datetime('now'))").bind(c.id,d,token),
        env.DB.prepare("UPDATE unlock_tokens SET status='used',used_at=datetime('now') WHERE id=?").bind(t.id)
      ]);
    } else {
      const existing=await env.DB.prepare('SELECT id FROM customer_unlocks WHERE customer_id=? AND unlock_type=? AND unlock_date=?').bind(c.id,t.unlock_type,d).first();
      if(existing)return json({ok:false,error:'Lượt này đã được mở khóa hôm nay.'},409);
      await env.DB.batch([
        env.DB.prepare("INSERT INTO customer_unlocks(customer_id,unlock_type,unlock_date,token,created_at) VALUES(?,?,?,?,datetime('now'))").bind(c.id,t.unlock_type,d,token),
        env.DB.prepare("UPDATE unlock_tokens SET status='used',used_at=datetime('now') WHERE id=?").bind(t.id)
      ]);
    }
    return json({ok:true,unlockType:Number(t.unlock_type),message:'Mở khóa thành công.'});
  }

  if (url.pathname === '/api/admin/setup' && req.method === 'POST') {
    const b = await req.json();
    const result = await createAdminAccount(env, b.password);
    return json(result, result.ok ? 200 : 400);
  }

  if (url.pathname === '/api/admin/login' && req.method === 'POST') {
    const b=await req.json(); const inputPassword=String(b.password??'').trim();
    if(inputPassword.length<6)return json({ok:false,error:'Mật khẩu phải có ít nhất 6 ký tự.'},400);
    const account=await getAdminAccount(env);
    if(!account)return json({ok:false,error:'Chưa khởi tạo tài khoản quản trị. Hãy tạo mật khẩu lần đầu.'},503);
    const passwordHash=await hashPassword(inputPassword,account.salt);
    if(passwordHash!==account.password_hash)return json({ok:false,error:'Sai mật khẩu.'},401);
    const session=await createAdminSession(env);
    return json({ok:true,token:session.raw,expiresAt:session.expires},200,{'Set-Cookie':adminCookie(session.raw)});
  }

  if (url.pathname === '/api/admin/session' && req.method === 'GET') {
    const account=await getAdminAccount(env);
    const ok=!!account && await adminOk(req,env);
    if(ok) {
      const cookieToken=readCookie(req,'anna_admin');
      const headerToken=req.headers.get('X-Admin-Token') || '';
      // Prefer whichever token is actually valid. This repairs the common
      // F5 case where an old cookie survives while localStorage has the new token.
      let token='';
      if(cookieToken && await adminSessionOk(env,cookieToken)) token=cookieToken;
      else if(headerToken && await adminSessionOk(env,headerToken)) token=headerToken;
      else if(cookieToken && cookieToken===account.token_hash) token=cookieToken;
      else if(headerToken && headerToken===account.token_hash) token=headerToken;
      if(!token) return json({ok:false},401,{'Set-Cookie':clearAdminCookie()});
      // Sliding 30-day session: an active admin session is extended on F5.
      const tokenHash=await sha256(token);
      const nextExpiry=Date.now()+30*24*60*60*1000;
      await ensureAdminTables(env);
      await env.DB.prepare('UPDATE admin_sessions SET expires_at=? WHERE token_hash=?').bind(nextExpiry,tokenHash).run();
      return json({ok:true,token:token,expiresAt:nextExpiry},200,{'Set-Cookie':adminCookie(token)});
    }
    return json({ok:false},401,{'Set-Cookie':clearAdminCookie()});
  }

  if (url.pathname === '/api/admin/logout' && req.method === 'POST') {
    const raw=readCookie(req,'anna_admin') || req.headers.get('X-Admin-Token') || '';
    if(raw) {
      await ensureAdminTables(env);
      await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await sha256(raw)).run();
    }
    return json({ok:true},200,{'Set-Cookie':clearAdminCookie()});
  }

  if (url.pathname === '/api/admin/status' && req.method === 'GET') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    await ensurePlayColumns(env);
    await ensureCycleState(env);
    const synced=await syncCycleState(env);
    const state=await env.DB.prepare('SELECT cycle_no,position,updated_at FROM cycle_state_dynamic WHERE id=1').first();
    const total=await env.DB.prepare('SELECT COUNT(*) AS n FROM plays').first();
    const cycle=await env.DB.prepare('SELECT COUNT(*) AS n FROM plays WHERE cycle600_no=?').bind(Number(state.cycle_no)).first();
    const cfg=await getCycleConfig(env);
    const size=Number(cfg?.cycle_size||BASE_CYCLE_SIZE);
    const current=Math.min(size,Number(state.position||0));
    const dc=await getDailyConfig(env);
    return json({ok:true,cycleNo:Number(state.cycle_no),currentPosition:current,cycleSize:size,pendingCycleSize:cfg?.pending_cycle_size?Number(cfg.pending_cycle_size):null,cyclePlays:Number(cycle?.n||0),totalPlays:Number(total?.n||0),updatedAt:state.updated_at||null,daily:{totalDaily:Number(dc?.total_daily||4),freeDaily:Number(dc?.free_daily||2),taskDaily:Number(dc?.task_daily||2),taskEnabled:Number(dc?.task_enabled||0)===1,taskLabel:String(dc?.task_label||'')}});
  }

  if (url.pathname === '/api/admin/daily-config' && req.method === 'GET') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    const dc=await getDailyConfig(env);
    return json({ok:true,totalDaily:Number(dc?.total_daily||4),freeDaily:Number(dc?.free_daily||2),taskDaily:Number(dc?.task_daily||2),taskEnabled:Number(dc?.task_enabled||0)===1,taskLabel:String(dc?.task_label||'')});
  }
  if (url.pathname === '/api/admin/daily-config' && req.method === 'POST') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    const b=await req.json();
    const totalDaily=Math.floor(Number(b.totalDaily)), freeDaily=Math.floor(Number(b.freeDaily)), taskDaily=Math.floor(Number(b.taskDaily));
    const taskEnabled=b.taskEnabled===undefined ? true : !!b.taskEnabled;
    const taskLabel=String(b.taskLabel??'Mời bạn cùng ăn tại PHỞ NHÀ ANNA').trim().slice(0,200);
    if(!Number.isInteger(totalDaily)||totalDaily<1||totalDaily>100)return json({ok:false,error:'Tổng số lượt/ngày phải từ 1 đến 100.'},400);
    if(!Number.isInteger(freeDaily)||freeDaily<0||freeDaily>totalDaily)return json({ok:false,error:'Số lượt miễn phí/ngày không hợp lệ.'},400);
    if(!Number.isInteger(taskDaily)||taskDaily<0||taskDaily!==totalDaily-freeDaily)return json({ok:false,error:'Số lượt làm nhiệm vụ phải bằng Tổng số lượt/ngày trừ Số lượt miễn phí/ngày.'},400);
    await ensureDailyConfig(env);
    await env.DB.prepare("UPDATE daily_config SET total_daily=?,free_daily=?,task_daily=?,task_enabled=?,task_label=?,updated_at=datetime('now') WHERE id=1").bind(totalDaily,freeDaily,taskDaily,taskEnabled?1:0,taskLabel||'Làm nhiệm vụ để thêm lượt').run();
    return json({ok:true,totalDaily,freeDaily,taskDaily,taskEnabled,taskLabel:taskLabel||'Làm nhiệm vụ để thêm lượt',message:'Đã cập nhật giới hạn lượt/ngày. Trang khách hàng sẽ áp dụng cấu hình mới ngay.'});
  }

  if (url.pathname === '/api/admin/cycle-config' && req.method === 'GET') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    const s=await syncCycleState(env); const c=await getCycleConfig(env);
    const quotas=quotaObject(c), pendingQuotas=quotaObject(c,true);
    return json({ok:true,cycleNo:Number(s?.cycleNo||1),currentPosition:Number(s?.position||0),cycleSize:Number(c?.cycle_size||BASE_CYCLE_SIZE),pendingCycleSize:c?.pending_cycle_size?Number(c.pending_cycle_size):null,quotas,pendingQuotas,consolation:Number(c?.cycle_size||BASE_CYCLE_SIZE)-Object.values(quotas).reduce((a,b)=>a+b,0)});
  }

  if (url.pathname === '/api/admin/cycle-config' && req.method === 'POST') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    const b=await req.json();
    const size=Math.floor(Number(b.cycleSize));
    if(!Number.isInteger(size)||size<100||size>MAX_CYCLE_SIZE)return json({ok:false,error:'Số lượt/chu kỳ phải là số nguyên từ 100 đến 1.000.000.'},400);
    const cfg=await getCycleConfig(env);
    const currentQuotas=quotaObject(cfg);
    const incoming={
      0: b.quota0===undefined ? currentQuotas[0] : Math.floor(Number(b.quota0)),
      1: b.quota1===undefined ? currentQuotas[1] : Math.floor(Number(b.quota1)),
      2: b.quota2===undefined ? currentQuotas[2] : Math.floor(Number(b.quota2)),
      3: b.quota3===undefined ? currentQuotas[3] : Math.floor(Number(b.quota3)),
      4: b.quota4===undefined ? currentQuotas[4] : Math.floor(Number(b.quota4))
    };
    const valid=validateQuotas(size,incoming); if(!valid.ok)return json(valid,400);
    await ensureCycleState(env); const state=await env.DB.prepare('SELECT cycle_no,position FROM cycle_state_dynamic WHERE id=1').first();
    const pos=Number(state?.position||0);
    const params=[size,incoming[0],incoming[1],incoming[2],incoming[3],incoming[4]];
    if(pos===0){
      await env.DB.prepare(`UPDATE cycle_config SET cycle_size=?,pending_cycle_size=NULL,
        quota_prize0=?,quota_prize1=?,quota_prize2=?,quota_prize3=?,quota_prize4=?,
        pending_quota_prize0=NULL,pending_quota_prize1=NULL,pending_quota_prize2=NULL,pending_quota_prize3=NULL,pending_quota_prize4=NULL,
        updated_at=datetime('now') WHERE id=1`).bind(...params).run();
      return json({ok:true,mode:'immediate',cycleSize:size,quotas:incoming,consolation:valid.consolation,message:`Đã lưu ${size.toLocaleString('vi-VN')} lượt/chu kỳ và cấu hình số lượng giải. Các giải sẽ được phân bổ đều trong chu kỳ.`});
    }
    await env.DB.prepare(`UPDATE cycle_config SET pending_cycle_size=?,
      pending_quota_prize0=?,pending_quota_prize1=?,pending_quota_prize2=?,pending_quota_prize3=?,pending_quota_prize4=?,updated_at=datetime('now') WHERE id=1`).bind(...params).run();
    return json({ok:true,mode:'next_cycle',cycleSize:Number(cfg?.cycle_size||BASE_CYCLE_SIZE),pendingCycleSize:size,quotas:currentQuotas,pendingQuotas:incoming,consolation:valid.consolation,message:`Đã đặt ${size.toLocaleString('vi-VN')} lượt và số lượng giải cho chu kỳ kế tiếp. Chu kỳ hiện tại vẫn giữ cấu hình cũ.`});
  }

  if (url.pathname === '/api/admin/change-password' && req.method === 'POST') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    const b=await req.json(); const p=String(b.newPassword??'').trim();
    if(p.length<8)return json({ok:false,error:'Mật khẩu mới phải có ít nhất 8 ký tự.'},400);
    if(p.length>128)return json({ok:false,error:'Mật khẩu mới quá dài.'},400);
    const salt=randomHex(16); const ph=await hashPassword(p,salt); const th=await sha256(p);
    const r=await env.DB.prepare("UPDATE admin_credentials SET password_hash=?,salt=?,token_hash=?,updated_at=datetime('now') WHERE id=1").bind(ph,salt,th).run();
    if(r.meta.changes!==1)return json({ok:false,error:'Không thể đổi mật khẩu quản trị.'},500);
    const session=await createAdminSession(env);
    return json({ok:true,token:session.raw,expiresAt:session.expires,message:'Đã đổi mật khẩu quản trị thành công.'},200,{'Set-Cookie':adminCookie(session.raw)});
  }

  if (url.pathname === '/api/admin/unlock' && req.method === 'POST') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    const b=await req.json(); const phone=normPhone(b.phone);
    if(phone.length<9||phone.length>12)return json({ok:false,error:'Số điện thoại không hợp lệ.'},400);
    const c=await env.DB.prepare('SELECT id,phone,name FROM customers WHERE phone=?').bind(phone).first();
    if(!c)return json({ok:false,error:'Số điện thoại này chưa đăng ký chương trình.'},404);
    const dc=await getDailyConfig(env); const taskDaily=Math.max(0,Number(dc?.task_daily||0));
    if(taskDaily<=0 || Number(dc?.task_enabled||0)!==1)return json({ok:false,error:'Hiện cấu hình không có lượt làm nhiệm vụ để mở.'},400);
    const d=today();
    await ensureUnlockTables(env);
    const existing=await env.DB.prepare('SELECT id FROM admin_extra_unlocks WHERE customer_id=? AND unlock_date=?').bind(c.id,d).first();
    if(existing)return json({ok:true,already:true,unlockType:4,message:`Khách này đã được mở thêm ${taskDaily} lượt hôm nay. Không cộng trùng.`,customer:{name:c.name,phone:c.phone},taskDaily,totalDaily:Number(dc?.total_daily||4),freeDaily:Number(dc?.free_daily||2)});
    const token = tokenCode('TASK');
    try {
      await env.DB.prepare("INSERT INTO admin_extra_unlocks(customer_id,unlock_date,token,created_at) VALUES(?,?,?,datetime('now'))").bind(c.id,d,token).run();
    } catch (e) {
      console.error('admin unlock failed', e);
      const race=await env.DB.prepare('SELECT id FROM admin_extra_unlocks WHERE customer_id=? AND unlock_date=?').bind(c.id,d).first();
      if(!race) return json({ok:false,error:'Không thể mở lượt cho khách lúc này. Vui lòng thử lại.'},500);
      return json({ok:true,already:true,unlockType:4,message:`Khách này đã được mở thêm ${taskDaily} lượt hôm nay. Không cộng trùng.`,customer:{name:c.name,phone:c.phone},taskDaily,totalDaily:Number(dc?.total_daily||4),freeDaily:Number(dc?.free_daily||2)});
    }
    return json({ok:true,unlockType:4,message:`Đã mở thêm ${taskDaily} lượt cho khách.`,customer:{name:c.name,phone:c.phone},taskDaily,totalDaily:Number(dc?.total_daily||4),freeDaily:Number(dc?.free_daily||2)});
  }

  if (url.pathname === '/api/admin/delete-customer' && req.method === 'POST') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    const phone=normPhone((await req.json()).phone); if(phone.length<9||phone.length>12)return json({ok:false,error:'Số điện thoại không hợp lệ.'},400);
    const c=await env.DB.prepare('SELECT id,name,phone FROM customers WHERE phone=?').bind(phone).first(); if(!c)return json({ok:false,error:'Không tìm thấy khách hàng.'},404);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM customer_unlocks WHERE customer_id=?').bind(c.id),
      env.DB.prepare('DELETE FROM admin_extra_unlocks WHERE customer_id=?').bind(c.id),
      env.DB.prepare('DELETE FROM unlock_tokens WHERE customer_id=? OR phone=?').bind(c.id,phone),
      env.DB.prepare('DELETE FROM plays WHERE customer_id=?').bind(c.id),
      env.DB.prepare('DELETE FROM customers WHERE id=?').bind(c.id)
    ]);
    return json({ok:true,message:`Đã xóa khách hàng ${c.name} (${c.phone}) và toàn bộ dữ liệu liên quan.`});
  }
  if (url.pathname === '/api/admin/delete-all-customers' && req.method === 'POST') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    await env.DB.batch([env.DB.prepare('DELETE FROM customer_unlocks'),env.DB.prepare('DELETE FROM admin_extra_unlocks'),env.DB.prepare('DELETE FROM unlock_tokens'),env.DB.prepare('DELETE FROM plays'),env.DB.prepare('DELETE FROM customers')]);
    // Xóa dữ liệu test nhưng đưa bộ đếm về đầu chu kỳ 1.
    await ensureCycleState(env);
    await env.DB.prepare("UPDATE cycle_state_dynamic SET cycle_no=1,position=0,updated_at=datetime('now') WHERE id=1").run();
    await env.DB.prepare("UPDATE cycle_config SET cycle_size=COALESCE(pending_cycle_size,cycle_size),pending_cycle_size=NULL,updated_at=datetime('now') WHERE id=1").run();
    const cfg=await getCycleConfig(env);
    return json({ok:true,message:`Đã xóa toàn bộ khách hàng và dữ liệu liên quan; bộ đếm đã về 0/${Number(cfg.cycle_size||600).toLocaleString('vi-VN')}.`});
  }

  if (url.pathname === '/api/admin/plays' && req.method === 'GET') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    await ensurePlayColumns(env);
    const rows=await env.DB.prepare('SELECT plays.id,customers.name,customers.phone,plays.play_date,plays.prize_name,plays.reward_code,plays.redeemed,plays.redemption_count,plays.redeemed_at,plays.expires_at,plays.cycle600_no,plays.cycle600_position,plays.created_at FROM plays JOIN customers ON customers.id=plays.customer_id ORDER BY plays.id DESC LIMIT 500').all();
    return json({ok:true,rows:rows.results});
  }

  if (url.pathname === '/api/admin/redeem' && req.method === 'POST') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    await ensurePlayColumns(env);
    const code=String((await req.json()).code||'').trim();
    const r=await env.DB.prepare('SELECT id,customer_id,prize_index,redemption_count,redeemed_at,expires_at FROM plays WHERE reward_code=?').bind(code).first();
    if(!r)return json({ok:false,error:'Mã không hợp lệ.'},400);
    const idx=Number(r.prize_index), count=Number(r.redemption_count||0); const max=idx===0?2:1;
    if(r.expires_at&&new Date(r.expires_at).getTime()<=Date.now())return json({ok:false,error:'Mã đã quá hạn.'},400);
    if(count>=max)return json({ok:false,error:max===2?'Giải 2 tô phở đã đổi đủ 2 tô.':'Mã đã được đổi quà.'},400);
    if(count>0 && r.redeemed_at){
      const lastDay=await env.DB.prepare("SELECT date(datetime(?, '+7 hours')) AS d").bind(r.redeemed_at).first();
      if(lastDay?.d===today())return json({ok:false,error:'Giải đặc biệt chỉ được đổi tối đa 1 tô trong một ngày.'},400);
    }
    const next=count+1;
    const updated=await env.DB.prepare("UPDATE plays SET redeemed=?,redemption_count=?,redeemed_at=datetime('now') WHERE id=? AND redemption_count=?").bind(next>=max?1:0,next,r.id,count).run();
    if(updated.meta.changes!==1)return json({ok:false,error:'Mã vừa được xử lý bởi nhân viên khác. Vui lòng kiểm tra lại.'},409);
    return json({ok:true,redemptionCount:next,maxRedemptions:max,remainingRedemptions:max-next});
  }

  if (url.pathname === '/api/reward' && req.method === 'GET') {
    const code=url.searchParams.get('code')||''; const r=await env.DB.prepare('SELECT plays.reward_code,plays.prize_name,plays.prize_index,plays.redeemed,plays.redemption_count,plays.redeemed_at,plays.created_at,plays.expires_at,customers.name FROM plays JOIN customers ON customers.id=plays.customer_id WHERE plays.reward_code=?').bind(code).first();
    if(!r)return json({ok:false,error:'Không tìm thấy mã.'},404);
    const expired=r.expires_at?new Date(r.expires_at).getTime()<=Date.now():false;
    return json({ok:true,expired,reward:r});
  }
  return null;
}

export default { async fetch(req,env) {
  const url=new URL(req.url);
  try {
    const result=await api(req,env,url);
    if(result)return result;
    const asset=await env.ASSETS.fetch(req);
    // Prevent browser from keeping an old admin/customer HTML shell after a new deployment.
    const headers=new Headers(asset.headers);
    if(url.pathname==='/' || url.pathname==='/index.html' || url.pathname==='/admin.html'){
      headers.set('Cache-Control','no-store, no-cache, must-revalidate');
      headers.set('Pragma','no-cache');
    }
    return new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers});
  }
  catch(e){ console.error('Unhandled worker error:',e); return json({ok:false,error:'Lỗi máy chủ. Vui lòng thử lại.'},500); }
} };
