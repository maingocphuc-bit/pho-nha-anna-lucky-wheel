import QRCode from 'qrcode-svg';

// Thứ tự phải trùng tuyệt đối với các ô trên bánh quay trong index.html.
const PRIZES = [
  { name: 'Ăn phở miễn phí 2 buổi/tuần', odds: 0, special: true, cap: 1 },
  { name: '1 Tô Phở Miễn Phí 50K', odds: 0, special: true, cap: 1 },
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
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}
function tokenCode(prefix = 'ANNA') {
  return prefix + '-' + crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
}
function weightedPick(counts) {
  const available = PRIZES.map((p, i) => ({ p, i }))
    .filter(({ p, i }) => p.cap == null || counts[i] < p.cap);
  const total = available.reduce((sum, x) => sum + x.p.odds, 0);
  let r = Math.random() * total;
  for (const { p, i } of available) {
    if (r < p.odds) return i;
    r -= p.odds;
  }
  return available[available.length - 1].i;
}
function makeQrDataUrl(text) {
  const svg = new QRCode({
    content: text, padding: 2, width: 300, height: 300,
    color: '#000000', background: '#ffffff', ecl: 'M'
  }).svg();
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
async function sha256(text) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const ADMIN_LOGIN_CODE = 'PhoAnna@2026';

async function adminOk(req) {
  const supplied = req.headers.get('X-Admin-Token') || '';
  return !!(supplied && supplied === await sha256(ADMIN_LOGIN_CODE));
}
async function customerUnlocks(env, customerId, date) {
  const rows = await env.DB.prepare(
    'SELECT unlock_type FROM customer_unlocks WHERE customer_id=? AND unlock_date=?'
  ).bind(customerId, date).all();
  const types = new Set((rows.results || []).map(r => Number(r.unlock_type)));
  return { unlock2: types.has(2), unlock3: types.has(3) };
}

async function api(req, env, url) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (url.pathname === '/api/register' && req.method === 'POST') {
    const b = await req.json();
    const name = String(b.name || '').trim();
    const phone = normPhone(b.phone);
    if (name.length < 2 || phone.length < 9 || phone.length > 12)
      return json({ ok: false, error: 'Tên hoặc số điện thoại không hợp lệ.' }, 400);

    await env.DB.prepare(
      "INSERT INTO customers(name,phone) VALUES(?,?) ON CONFLICT(phone) DO UPDATE SET name=excluded.name,updated_at=datetime('now')"
    ).bind(name, phone).run();
    const c = await env.DB.prepare('SELECT id,name,phone FROM customers WHERE phone=?').bind(phone).first();
    const d = today();
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM plays WHERE customer_id=? AND play_date=?').bind(c.id, d).first();
    const unlocks = await customerUnlocks(env, c.id, d);
    const used = Number(row?.n || 0);
    return json({ ok: true, customer: { id: c.id, name: c.name }, used,
      remaining: Math.max(0, 3 - used), ...unlocks });
  }

  if (url.pathname === '/api/spin' && req.method === 'POST') {
    const b = await req.json();
    const phone = normPhone(b.phone);
    if (phone.length < 9 || phone.length > 12) return json({ ok: false, error: 'Số điện thoại không hợp lệ.' }, 400);
    const c = await env.DB.prepare('SELECT id,name FROM customers WHERE phone=?').bind(phone).first();
    if (!c) return json({ ok: false, error: 'Khách chưa đăng ký.' }, 404);

    const d = today();
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM plays WHERE customer_id=? AND play_date=?').bind(c.id, d).first();
    const used = Number(row?.n || 0);
    const unlocks = await customerUnlocks(env, c.id, d);
    if (used >= 3) return json({ ok: false, error: 'Hôm nay khách đã hết 3 lượt quay.' }, 429);
    if (used === 1 && !unlocks.unlock2)
      return json({ ok: false, code: 'LOCKED_2', error: 'Lượt 2 cần được quán xác nhận mở khóa tại chỗ.', ...unlocks }, 403);
    if (used === 2 && !unlocks.unlock3)
      return json({ ok: false, code: 'LOCKED_3', error: 'Lượt 3 cần được quán xác nhận mở khóa tại chỗ.', ...unlocks }, 403);

    // Hai bộ đếm được cập nhật trong CÙNG một D1 batch.
    // Mỗi UPDATE có RETURNING để lấy vị trí đã được giữ riêng cho request này.
    // D1 serializes writes to the same row, vì vậy hai khách đồng thời không nhận
    // cùng một vị trí trong cùng một bộ đếm.
    const reservations = await env.DB.batch([
      env.DB.prepare(`
        UPDATE cycle_state
        SET position = CASE WHEN position >= 300 THEN 1 ELSE position + 1 END,
            cycle_no = CASE WHEN position >= 300 THEN cycle_no + 1 ELSE cycle_no END,
            updated_at = datetime('now')
        WHERE id = 1
        RETURNING position, cycle_no
      `),
      env.DB.prepare(`
        UPDATE cycle_state_200
        SET position = CASE WHEN position >= 200 THEN 1 ELSE position + 1 END,
            cycle_no = CASE WHEN position >= 200 THEN cycle_no + 1 ELSE cycle_no END,
            updated_at = datetime('now')
        WHERE id = 1
        RETURNING position, cycle_no
      `)
    ]);
    const reservation300 = reservations?.[0]?.results?.[0];
    const reservation200 = reservations?.[1]?.results?.[0];
    if (!reservation300 || !reservation200)
      return json({ ok: false, error: 'Chưa khởi tạo đầy đủ bộ đếm chương trình.' }, 500);

    const cyclePosition300 = Number(reservation300.position);
    const cyclePosition200 = Number(reservation200.position);

    const cycleRows = await env.DB.prepare(
      'SELECT prize_index FROM plays WHERE cycle_no=?'
    ).bind(Number(reservation300.cycle_no)).all();
    const counts = [0, 0, 0, 0, 0, 0];
    for (const item of (cycleRows.results || [])) {
      const idx = Number(item.prize_index);
      if (Number.isInteger(idx) && idx >= 0 && idx < PRIZES.length) counts[idx]++;
    }

    // Giải mốc 200 và 300 là giải cố định; không đưa vào weightedPick().

    // Nếu hai mốc trùng nhau (mỗi 600 lượt), ưu tiên giải 1 tô phở 50K.
    // Giải ăn phở 2 buổi/tuần không bị mất: sẽ được trao ở mốc 300 hợp lệ kế tiếp.
    let i;
    if (cyclePosition200 === 200) i = 1;
    else if (cyclePosition300 === 300) i = 0;
    else i = weightedPick(counts);
    const rewardCode = tokenCode('ANNA');
    const p = PRIZES[i];
    const specialExpiresAt = (i === 0 || i === 1) ? new Date(Date.now() + 7 * 86400000).toISOString() : null;
    await env.DB.prepare(
      'INSERT INTO plays(customer_id,play_date,prize_index,prize_name,reward_code,expires_at,cycle_no,cycle_position,cycle200_no,cycle200_position) VALUES(?,?,?,?,?,?,?,?,?,?)'
    ).bind(c.id, d, i, p.name, rewardCode, specialExpiresAt, Number(reservation300.cycle_no), cyclePosition300, Number(reservation200.cycle_no), cyclePosition200).run();
    let qr;
    try { qr = makeQrDataUrl(rewardCode); }
    catch (e) { console.error(e); return json({ ok: false, error: 'Tạo mã QR thất bại.' }, 500); }
    return json({ ok: true, prizeIndex: i, prize: p.name, special: p.special, rewardCode, qr,
      specialTerms: i === 0 ? 'Có hiệu lực 7 ngày; tối đa 1 phần/ngày; giá trị hóa đơn tối đa 50.000đ/lần; không quy đổi tiền mặt.' : (i === 1 ? 'Áp dụng cho 1 tô phở trị giá tối đa 50.000đ; không quy đổi tiền mặt.' : null),
      remaining: Math.max(0, 3 - (used + 1)) });
  }

  if (url.pathname === '/api/unlock/claim' && req.method === 'POST') {
    const b = await req.json();
    const phone = normPhone(b.phone);
    const token = String(b.token || '').trim().toUpperCase();
    if (!token || phone.length < 9 || phone.length > 12)
      return json({ ok: false, error: 'Vui lòng nhập đúng số điện thoại và mã mở khóa.' }, 400);
    const c = await env.DB.prepare('SELECT id FROM customers WHERE phone=?').bind(phone).first();
    if (!c) return json({ ok: false, error: 'Không tìm thấy khách hàng.' }, 404);
    const t = await env.DB.prepare(
      "SELECT id,unlock_type,expires_at,status FROM unlock_tokens WHERE token=?"
    ).bind(token).first();
    if (!t) return json({ ok: false, error: 'Mã mở khóa không tồn tại.' }, 404);
    if (t.status !== 'issued') return json({ ok: false, error: 'Mã mở khóa đã được sử dụng.' }, 409);
    if (new Date(t.expires_at).getTime() <= Date.now()) {
      await env.DB.prepare("UPDATE unlock_tokens SET status='expired' WHERE id=?").bind(t.id).run();
      return json({ ok: false, error: 'Mã mở khóa đã hết hạn.' }, 410);
    }
    const d = today();
    const existing = await env.DB.prepare(
      'SELECT id FROM customer_unlocks WHERE customer_id=? AND unlock_type=? AND unlock_date=?'
    ).bind(c.id, t.unlock_type, d).first();
    if (existing) return json({ ok: false, error: 'Lượt này đã được mở khóa hôm nay.' }, 409);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO customer_unlocks(customer_id,unlock_type,unlock_date,token,created_at) VALUES(?,?,?,?,datetime(\'now\'))').bind(c.id, t.unlock_type, d, token),
      env.DB.prepare("UPDATE unlock_tokens SET status='used',used_at=datetime('now'),customer_id=? WHERE id=?").bind(c.id, t.id)
    ]);
    return json({ ok: true, unlockType: Number(t.unlock_type), message: 'Mở khóa thành công.' });
  }

  if (url.pathname === '/api/admin/login' && req.method === 'POST') {
    const b = await req.json();

    // Đăng nhập độc lập với Cloudflare Secret.
    // Mã quản trị hiện tại: PhoAnna@2026
    const inputPassword = String(b.password ?? '').trim();

    if (inputPassword !== ADMIN_LOGIN_CODE) {
      return json({ ok: false, error: 'Sai mật khẩu.' }, 401);
    }

    return json({
      ok: true,
      token: await sha256(ADMIN_LOGIN_CODE)
    });
  }

  // Quán dùng endpoint này sau khi kiểm tra điều kiện tại chỗ.
  // unlockType chỉ nhận 2 hoặc 3; mã có hiệu lực 10 phút và chỉ dùng một lần.
  if (url.pathname === '/api/admin/unlock' && req.method === 'POST') {
    if (!(await adminOk(req))) return json({ ok: false, error: 'Không có quyền.' }, 401);
    const b = await req.json();
    const phone = normPhone(b.phone);
    const unlockType = Number(b.unlockType);
    if (phone.length < 9 || phone.length > 12 || ![2, 3].includes(unlockType))
      return json({ ok: false, error: 'Số điện thoại hoặc loại lượt mở khóa không hợp lệ.' }, 400);
    const c = await env.DB.prepare('SELECT id FROM customers WHERE phone=?').bind(phone).first();
    if (!c) return json({ ok: false, error: 'Khách chưa đăng ký.' }, 404);
    const token = tokenCode('UNLOCK');
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await env.DB.prepare(
      "INSERT INTO unlock_tokens(token,customer_id,phone,unlock_type,expires_at,status,created_at) VALUES(?,?,?,?,?, 'issued',datetime('now'))"
    ).bind(token, c.id, phone, unlockType, expires).run();
    const unlockUrl = new URL(url.origin + '/');
    unlockUrl.searchParams.set('unlock', token);
    return json({ ok: true, token, unlockType, expiresAt: expires, url: unlockUrl.toString(), qr: makeQrDataUrl(unlockUrl.toString()) });
  }


  // Xóa một khách hàng theo số điện thoại, kèm toàn bộ lượt quay và mã mở khóa liên quan.
  if (url.pathname === '/api/admin/delete-customer' && req.method === 'POST') {
    if (!(await adminOk(req))) return json({ ok: false, error: 'Không có quyền.' }, 401);
    const b = await req.json();
    const phone = normPhone(b.phone);
    if (phone.length < 9 || phone.length > 12)
      return json({ ok: false, error: 'Số điện thoại không hợp lệ.' }, 400);

    const c = await env.DB.prepare('SELECT id,name,phone FROM customers WHERE phone=?').bind(phone).first();
    if (!c) return json({ ok: false, error: 'Không tìm thấy khách hàng.' }, 404);

    await env.DB.batch([
      env.DB.prepare('DELETE FROM customer_unlocks WHERE customer_id=?').bind(c.id),
      env.DB.prepare('DELETE FROM unlock_tokens WHERE customer_id=? OR phone=?').bind(c.id, phone),
      env.DB.prepare('DELETE FROM plays WHERE customer_id=?').bind(c.id),
      env.DB.prepare('DELETE FROM customers WHERE id=?').bind(c.id)
    ]);

    return json({ ok: true, message: `Đã xóa khách hàng ${c.name} (${c.phone}) và toàn bộ dữ liệu liên quan.` });
  }

  // Xóa toàn bộ dữ liệu khách hàng, lượt quay, mã mở khóa và lịch sử đổi quà.
  if (url.pathname === '/api/admin/delete-all-customers' && req.method === 'POST') {
    if (!(await adminOk(req))) return json({ ok: false, error: 'Không có quyền.' }, 401);

    await env.DB.batch([
      env.DB.prepare('DELETE FROM customer_unlocks'),
      env.DB.prepare('DELETE FROM unlock_tokens'),
      env.DB.prepare('DELETE FROM plays'),
      env.DB.prepare('DELETE FROM customers')
    ]);

    return json({ ok: true, message: 'Đã xóa toàn bộ khách hàng và dữ liệu liên quan.' });
  }

  if (url.pathname === '/api/admin/plays' && req.method === 'GET') {
    if (!(await adminOk(req))) return json({ ok: false, error: 'Không có quyền.' }, 401);
    const rows = await env.DB.prepare(
      'SELECT plays.id,customers.name,customers.phone,plays.play_date,plays.prize_name,plays.reward_code,plays.redeemed,plays.redeemed_at,plays.expires_at,plays.created_at FROM plays JOIN customers ON customers.id=plays.customer_id ORDER BY plays.id DESC LIMIT 500'
    ).all();
    return json({ ok: true, rows: rows.results });
  }

  if (url.pathname === '/api/admin/redeem' && req.method === 'POST') {
    if (!(await adminOk(req))) return json({ ok: false, error: 'Không có quyền.' }, 401);
    const b = await req.json();
    const r = await env.DB.prepare(
      "UPDATE plays SET redeemed=1,redeemed_at=datetime('now') WHERE reward_code=? AND redeemed=0 AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))"
    ).bind(String(b.code || '')).run();
    if (r.meta.changes !== 1) return json({ ok: false, error: 'Mã không hợp lệ, đã đổi hoặc đã quá hạn.' }, 400);
    return json({ ok: true });
  }

  if (url.pathname === '/api/reward' && req.method === 'GET') {
    const codeVal = url.searchParams.get('code') || '';
    const r = await env.DB.prepare(
      'SELECT plays.reward_code,plays.prize_name,plays.redeemed,plays.redeemed_at,plays.created_at,plays.expires_at,customers.name FROM plays JOIN customers ON customers.id=plays.customer_id WHERE plays.reward_code=?'
    ).bind(codeVal).first();
    if (!r) return json({ ok: false, error: 'Không tìm thấy mã.' }, 404);
    const expired = r.expires_at ? new Date(r.expires_at).getTime() <= Date.now() : false;
    return json({ ok: true, expired, reward: r });
  }

  return null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      const result = await api(req, env, url);
      if (result) return result;
      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error('Unhandled worker error:', e);
      return json({ ok: false, error: 'Lỗi máy chủ. Vui lòng thử lại.' }, 500);
    }
  }
};
