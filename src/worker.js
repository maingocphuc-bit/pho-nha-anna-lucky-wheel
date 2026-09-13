import QRCode from 'qrcode-svg';

// Thứ tự này phải trùng tuyệt đối với các ô trên bánh quay ở index.html.
const PRIZES = [
  { name: '1 Tô Phở Miễn Phí 50K', odds: 2, special: true, cap: 2 },
  { name: 'Giảm giá 5K', odds: 15, special: false, cap: 4 },
  { name: '1 Chai Sữa Tươi Mát Lạnh', odds: 10, special: false, cap: 3 },
  { name: '1 Ly Trà Gừng Mát Lạnh', odds: 23, special: false, cap: 10 },
  { name: 'Chúc Bạn May Mắn Lần Sau', odds: 50, special: false }
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function normPhone(v) { return String(v || '').replace(/\D/g, ''); }

function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh'
  }).format(new Date());
}

function code() {
  return 'ANNA-' + crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
}

function unlockToken() {
  return 'UNLOCK-' + crypto.randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase();
}

function isoPlusMinutes(minutes) {
  return new Date(Date.now() + minutes * 60000).toISOString();
}

function weightedPick(counts) {
  const available = PRIZES.map((p, i) => ({ p, i }))
    .filter(({ p, i }) => p.cap == null || counts[i] < p.cap);
  let total = available.reduce((sum, x) => sum + x.p.odds, 0);
  let r = Math.random() * total;
  for (const { p, i } of available) {
    if (r < p.odds) return i;
    r -= p.odds;
  }
  return available[available.length - 1].i;
}

function makeQrDataUrl(text) {
  const svg = new QRCode({
    content: text,
    padding: 2,
    width: 260,
    height: 260,
    color: '#000000',
    background: '#ffffff',
    ecl: 'M'
  }).svg();

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

async function sha256(text) {
  const b = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(b)]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}

async function adminOk(req, env) {
  const token = req.headers.get('X-Admin-Token') || '';
  if (!token || !env.ADMIN_PASSWORD) return false;
  return token === await sha256(env.ADMIN_PASSWORD);
}

async function api(req, env, url) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (url.pathname === '/api/register' && req.method === 'POST') {
    const b = await req.json();
    const name = String(b.name || '').trim();
    const phone = normPhone(b.phone);

    if (name.length < 2 || phone.length < 9 || phone.length > 12) {
      return json({ ok: false, error: 'Tên hoặc số điện thoại không hợp lệ.' }, 400);
    }

    await env.DB.prepare(
      "INSERT INTO customers(name,phone) VALUES(?,?) " +
      "ON CONFLICT(phone) DO UPDATE SET name=excluded.name,updated_at=datetime('now')"
    ).bind(name, phone).run();

    const c = await env.DB.prepare(
      'SELECT id,name,phone FROM customers WHERE phone=?'
    ).bind(phone).first();

    const d = today();
    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM plays WHERE customer_id=? AND play_date=?'
    ).bind(c.id, d).first();

    const used = Number(row.n || 0);

    return json({
      ok: true,
      customer: { id: c.id, name: c.name },
      used,
      remaining: Math.max(0, 3 - used),
      unlock2: !!(await env.DB.prepare('SELECT 1 FROM customer_unlocks WHERE customer_id=? AND unlock_type=2 AND unlock_date=?').bind(c.id, d).first()),
      unlock3: !!(await env.DB.prepare('SELECT 1 FROM customer_unlocks WHERE customer_id=? AND unlock_type=3 AND unlock_date=?').bind(c.id, d).first())
    });
  }

  if (url.pathname === '/api/spin' && req.method === 'POST') {
    const b = await req.json();
    const phone = normPhone(b.phone);

    if (phone.length < 9 || phone.length > 12) {
      return json({ ok: false, error: 'Số điện thoại không hợp lệ.' }, 400);
    }

    const c = await env.DB.prepare(
      'SELECT id,name FROM customers WHERE phone=?'
    ).bind(phone).first();

    if (!c) {
      return json({ ok: false, error: 'Khách chưa đăng ký.' }, 404);
    }

    const d = today();
    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM plays WHERE customer_id=? AND play_date=?'
    ).bind(c.id, d).first();

    const used = Number(row.n || 0);

    if (used >= 3) {
      return json({ ok: false, error: 'Hôm nay khách đã hết 3 lượt quay.' }, 429);
    }

    if (used === 1) {
      const ok = await env.DB.prepare('SELECT 1 FROM customer_unlocks WHERE customer_id=? AND unlock_type=2 AND unlock_date=?').bind(c.id, d).first();
      if (!ok) return json({ ok:false, error:'Lượt 2 cần được quán xác nhận mở khóa tại chỗ.' }, 403);
    }
    if (used === 2) {
      const ok = await env.DB.prepare('SELECT 1 FROM customer_unlocks WHERE customer_id=? AND unlock_type=3 AND unlock_date=?').bind(c.id, d).first();
      if (!ok) return json({ ok:false, error:'Lượt 3 cần được quán xác nhận mở khóa tại chỗ.' }, 403);
    }

    // 100 lượt = 1 chu kỳ. Chỉ tính các lượt trong chu kỳ hiện tại.
    const totalRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM plays').first();
    const totalPlays = Number(totalRow?.n || 0);
    const cycleStart = Math.floor(totalPlays / 100) * 100;
    const cycleRows = await env.DB.prepare(
      'SELECT prize_index FROM plays WHERE id > ? ORDER BY id ASC LIMIT 100'
    ).bind(cycleStart).all();
    const counts = [0, 0, 0, 0, 0];
    // Chỉ dùng đúng 100 lượt gần nhất của chu kỳ hiện tại.
    const recent = cycleRows.results || [];
    for (const row of recent) {
      const idx = Number(row.prize_index);
      if (Number.isInteger(idx) && idx >= 0 && idx < 5) counts[idx]++;
    }
    const i = weightedPick(counts);
    const rewardCode = code();
    const p = PRIZES[i];

    await env.DB.prepare(
      'INSERT INTO plays(customer_id,play_date,prize_index,prize_name,reward_code) VALUES(?,?,?,?,?)'
    ).bind(c.id, d, i, p.name, rewardCode).run();

    let qr;
    try {
      qr = makeQrDataUrl(rewardCode);
    } catch (e) {
      console.error('QR generation failed:', e);
      return json({
        ok: false,
        error: 'Tạo mã QR thất bại. Phần thưởng đã được lưu, vui lòng thử lại.'
      }, 500);
    }

    return json({
      ok: true,
      prizeIndex: i,
      prize: p.name,
      special: p.special,
      rewardCode,
      qr,
      remaining: Math.max(0, 3 - (used + 1))
    });
  }

  if (url.pathname === '/api/unlock/claim' && req.method === 'POST') {
    const b = await req.json();
    const phone = normPhone(b.phone);
    const token = String(b.token || '').trim();
    if (!token || phone.length < 9) return json({ok:false,error:'Thiếu mã mở khóa hoặc số điện thoại.'},400);
    const d = today();
    const c = await env.DB.prepare('SELECT id FROM customers WHERE phone=?').bind(phone).first();
    if (!c) return json({ok:false,error:'Số điện thoại chưa đăng ký.'},404);
    const t = await env.DB.prepare("SELECT * FROM unlock_tokens WHERE token=? AND status='issued' AND expires_at>? ").bind(token, new Date().toISOString()).first();
    if (!t) return json({ok:false,error:'Mã mở khóa không hợp lệ hoặc đã hết hạn.'},400);
    if (normPhone(t.phone) !== phone) return json({ok:false,error:'Mã này không dành cho số điện thoại đã nhập.'},403);
    await env.DB.prepare("INSERT OR IGNORE INTO customer_unlocks(customer_id,unlock_type,unlock_date,token) VALUES(?,?,?,?)").bind(c.id,t.unlock_type,d,token).run();
    await env.DB.prepare("UPDATE unlock_tokens SET status='used',used_at=datetime('now') WHERE token=? AND status='issued'").bind(token).run();
    return json({ok:true,unlockType:t.unlock_type});
  }

  if (url.pathname === '/api/admin/login' && req.method === 'POST') {
    const b = await req.json();
    if (!env.ADMIN_PASSWORD || String(b.password || '') !== env.ADMIN_PASSWORD) {
      return json({ ok: false, error: 'Sai mật khẩu.' }, 401);
    }
    return json({
      ok: true,
      token: await sha256(env.ADMIN_PASSWORD)
    });
  }

  if (url.pathname === '/api/admin/unlock-token' && req.method === 'POST') {
    if (!(await adminOk(req, env))) return json({ok:false,error:'Không có quyền.'},401);
    const b = await req.json();
    const phone = normPhone(b.phone);
    const unlockType = Number(b.unlockType);
    if (phone.length < 9 || ![2,3].includes(unlockType)) return json({ok:false,error:'Số điện thoại hoặc loại lượt không hợp lệ.'},400);
    const token = unlockToken();
    const expires = isoPlusMinutes(10);
    await env.DB.prepare("INSERT INTO unlock_tokens(token,phone,unlock_type,expires_at) VALUES(?,?,?,?)").bind(token,phone,unlockType,expires).run();
    const claimUrl = new URL('/?unlock='+encodeURIComponent(token), url.origin).toString();
    return json({ok:true,token,unlockType,expiresAt:expires,claimUrl,qr:makeQrDataUrl(claimUrl)});
  }

  if (url.pathname === '/api/admin/plays' && req.method === 'GET') {
    if (!(await adminOk(req, env))) {
      return json({ ok: false, error: 'Không có quyền.' }, 401);
    }

    const rows = await env.DB.prepare(
      'SELECT plays.id,customers.name,customers.phone,plays.play_date,' +
      'plays.prize_name,plays.reward_code,plays.redeemed,plays.redeemed_at,plays.created_at ' +
      'FROM plays JOIN customers ON customers.id=plays.customer_id ' +
      'ORDER BY plays.id DESC LIMIT 500'
    ).all();

    return json({ ok: true, rows: rows.results });
  }

  if (url.pathname === '/api/admin/redeem' && req.method === 'POST') {
    if (!(await adminOk(req, env))) {
      return json({ ok: false, error: 'Không có quyền.' }, 401);
    }

    const b = await req.json();
    const r = await env.DB.prepare(
      "UPDATE plays SET redeemed=1,redeemed_at=datetime('now') " +
      "WHERE reward_code=? AND redeemed=0 AND datetime(created_at, '+2 days') > datetime('now')"
    ).bind(String(b.code || '')).run();

    return json({ ok: r.meta.changes === 1 });
  }

  if (url.pathname === '/api/reward' && req.method === 'GET') {
    const codeVal = url.searchParams.get('code') || '';

    const r = await env.DB.prepare(
      'SELECT plays.reward_code,plays.prize_name,plays.redeemed,plays.redeemed_at,customers.name ' +
      'FROM plays JOIN customers ON customers.id=plays.customer_id WHERE plays.reward_code=?'
    ).bind(codeVal).first();

    if (!r) return json({ ok: false, error: 'Không tìm thấy mã.' }, 404);

    return json({ ok: true, reward: r });
  }

  return null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      const r = await api(req, env, url);
      if (r) return r;
      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error('Unhandled worker error:', e);
      return json({ ok: false, error: 'Lỗi máy chủ. Em sẽ sửa tiếp.' }, 500);
    }
  }
};
