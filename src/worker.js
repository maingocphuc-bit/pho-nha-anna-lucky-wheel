import QRCode from 'qrcode-svg';

// Thứ tự phải trùng tuyệt đối với các ô trên bánh quay trong index.html.
const PRIZES = [
  { name: 'Ăn miễn phí 2 tô phở / 1 tuần', odds: 0, special: true, cap: 1 },
  { name: '1 Tô Phở Miễn Phí 50K', odds: 0, special: true, cap: 1 },
  { name: 'Giảm giá 5K', odds: 6, special: false, cap: 6 },
  { name: '1 Chai Sữa Tươi Mát Lạnh', odds: 4, special: false, cap: 4 },
  { name: '1 Ly Trà Gừng Mát Lạnh', odds: 25, special: false, cap: 25 },
  { name: 'Chúc Bạn May Mắn Lần Sau', odds: 65, special: false }
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
function weightedPick(counts, remainingRegularSpins) {
  // Trong mỗi chu kỳ 600 lượt, các giải thường có đúng quota:
  // Giảm 5K = 6, Sữa = 4, Trà gừng = 25. Các lượt còn lại là may mắn.
  const targets = [0, 0, 6, 4, 25, 0];
  const remaining = [];
  for (const i of [2, 3, 4]) {
    const left = targets[i] - Number(counts[i] || 0);
    if (left > 0) remaining.push({ i, left, weight: PRIZES[i].odds });
  }
  const totalQuota = remaining.reduce((sum, x) => sum + x.left, 0);
  if (totalQuota <= 0) return 5;
  // Những lượt cuối của chu kỳ sẽ tự động ép đủ quota còn thiếu.
  if (remainingRegularSpins <= totalQuota) {
    const pick = remaining[Math.floor(Math.random() * remaining.length)];
    return pick.i;
  }
  const totalWeight = remaining.reduce((sum, x) => sum + x.weight, 0);
  let r = Math.random() * totalWeight;
  for (const x of remaining) {
    if (r < x.weight) return x.i;
    r -= x.weight;
  }
  return remaining[remaining.length - 1].i;
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

const PBKDF2_ITERATIONS = 120000;
function randomHex(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function hashPassword(password, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/.{1,2}/g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function ensureAdminAccount(env) {
  let row = await env.DB.prepare('SELECT id,password_hash,salt,token_hash FROM admin_credentials WHERE id=1').first();
  if (row) return row;
  const bootstrap = String(env.ADMIN_PASSWORD || '').trim();
  if (!bootstrap) return null;
  const salt = randomHex(16);
  const passwordHash = await hashPassword(bootstrap, salt);
  const tokenHash = await sha256(bootstrap);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO admin_credentials(id,password_hash,salt,token_hash,updated_at) VALUES(1,?,?,?,datetime('now'))"
  ).bind(passwordHash, salt, tokenHash).run();
  return await env.DB.prepare('SELECT id,password_hash,salt,token_hash FROM admin_credentials WHERE id=1').first();
}
async function adminOk(req, env) {
  const supplied = req.headers.get('X-Admin-Token') || '';
  if (!supplied) return false;
  const account = await ensureAdminAccount(env);
  return !!(account && supplied === account.token_hash);
}

// Giải đặc biệt được đổi tối đa 2 lần; các giải khác tối đa 1 lần.
function maxRedemptions(prizeIndex) { return Number(prizeIndex) === 0 ? 2 : 1; }

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

    // Một khách chỉ được sở hữu một trong hai nhóm giải đặc biệt.
    // Đã từng trúng giải 1 tô phở 50K thì không được trúng giải 2 tô/tuần,
    // và ngược lại.
    const specialHistory = await env.DB.prepare(
      'SELECT DISTINCT prize_index FROM plays WHERE customer_id=? AND prize_index IN (0,1)'
    ).bind(c.id).all();
    const hasSpecial0 = (specialHistory.results || []).some(x => Number(x.prize_index) === 0);
    const hasSpecial1 = (specialHistory.results || []).some(x => Number(x.prize_index) === 1);
    if (hasSpecial0 && hasSpecial1) {
      return json({ ok: false, error: 'Dữ liệu giải đặc biệt của khách đang bị trùng nhóm. Vui lòng kiểm tra quản lý.' }, 409);
    }

    // Bộ đếm chính của chương trình: 600 lượt/chu kỳ.
    // Lượt 310: 1 Tô Phở Miễn Phí 50K.
    // Lượt 600: Ăn miễn phí 2 tô phở / 1 tuần.
    const reservation = await env.DB.prepare(`
      UPDATE cycle_state_600
      SET position = CASE WHEN position >= 600 THEN 1 ELSE position + 1 END,
          cycle_no = CASE WHEN position >= 600 THEN cycle_no + 1 ELSE cycle_no END,
          updated_at = datetime('now')
      WHERE id = 1
      RETURNING position, cycle_no
    `).run();
    const reserved = reservation?.results?.[0];
    if (!reserved) return json({ ok: false, error: 'Chưa khởi tạo bộ đếm 600 lượt của chương trình.' }, 500);

    const cyclePosition = Number(reserved.position);
    const cycleNo = Number(reserved.cycle_no);
    const cycleRows = await env.DB.prepare(
      'SELECT prize_index FROM plays WHERE cycle600_no=?'
    ).bind(cycleNo).all();
    const counts = [0, 0, 0, 0, 0, 0];
    for (const item of (cycleRows.results || [])) {
      const idx = Number(item.prize_index);
      if (Number.isInteger(idx) && idx >= 0 && idx < PRIZES.length) counts[idx]++;
    }

    let i;
    if (cyclePosition === 600) i = 0;
    else if (cyclePosition === 310) i = 1;
    else i = weightedPick(counts, 598 - ((cyclePosition - 1) - (cyclePosition > 310 ? 1 : 0)));

    // Nếu khách đã từng trúng một giải đặc biệt, không cho trúng giải đặc biệt còn lại.
    if ((i === 0 && hasSpecial1) || (i === 1 && hasSpecial0)) {
      i = 5;
    }
    const rewardCode = tokenCode('ANNA');
    const p = PRIZES[i];
    // Giải 2 tô phở/tuần có hạn 7 ngày; giải 1 tô phở 50K có hạn 2 ngày.
    // Các giải còn lại chỉ có hiệu lực đến 23:59:59 của ngày trúng thưởng
    // theo giờ Việt Nam.
    const specialExpiresAt = i === 0
      ? new Date(Date.now() + 7 * 86400000).toISOString()
      : i === 1
        ? new Date(Date.now() + 2 * 86400000).toISOString()
        : new Date(`${d}T23:59:59+07:00`).toISOString();
    await env.DB.prepare(
      'INSERT INTO plays(customer_id,play_date,prize_index,prize_name,reward_code,expires_at,cycle_no,cycle_position,cycle200_no,cycle200_position,cycle600_no,cycle600_position) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(c.id, d, i, p.name, rewardCode, specialExpiresAt, cycleNo, cyclePosition, 1, null, cycleNo, cyclePosition).run();
    let qr;
    try { qr = makeQrDataUrl(rewardCode); }
    catch (e) { console.error(e); return json({ ok: false, error: 'Tạo mã QR thất bại.' }, 500); }
    return json({ ok: true, prizeIndex: i, prize: p.name, special: p.special, rewardCode, qr,
      specialTerms: i === 0 ? 'Có hiệu lực 7 ngày; tối đa 1 tô/ngày; giá trị tối đa 50.000đ/tô; không quy đổi tiền mặt.' : (i === 1 ? 'Có hiệu lực trong 2 ngày kể từ ngày nhận thưởng; áp dụng cho 1 tô phở trị giá tối đa 50.000đ; không quy đổi tiền mặt.' : 'Chỉ áp dụng trong ngày trúng thưởng.'),
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
    const inputPassword = String(b.password ?? '').trim();
    if (inputPassword.length < 6) return json({ ok: false, error: 'Mật khẩu phải có ít nhất 6 ký tự.' }, 400);
    let account = await ensureAdminAccount(env);
    if (!account) return json({ ok: false, error: 'Chưa cấu hình ADMIN_PASSWORD trên Cloudflare để khởi tạo tài khoản quản trị.' }, 503);
    const passwordHash = await hashPassword(inputPassword, account.salt);
    if (passwordHash !== account.password_hash) return json({ ok: false, error: 'Sai mật khẩu.' }, 401);
    return json({ ok: true, token: account.token_hash });
  }

  if (url.pathname === '/api/admin/status' && req.method === 'GET') {
    if (!(await adminOk(req, env))) return json({ ok: false, error: 'Không có quyền.' }, 401);
    const state = await env.DB.prepare('SELECT cycle_no, position, updated_at FROM cycle_state_600 WHERE id=1').first();
    if (!state) return json({ ok: false, error: 'Chưa khởi tạo bộ đếm 600 lượt.' }, 500);
    const cycleNo = Number(state.cycle_no || 1);
    const position = Number(state.position || 0);
    const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM plays').first();
    const cycleTotal = await env.DB.prepare('SELECT COUNT(*) AS n FROM plays WHERE cycle600_no=?').bind(cycleNo).first();
    return json({ ok: true, cycleNo, currentPosition: position, cyclePlays: Number(cycleTotal?.n || 0), totalPlays: Number(total?.n || 0), updatedAt: state.updated_at || null });
  }

  if (url.pathname === '/api/admin/change-password' && req.method === 'POST') {
    if (!(await adminOk(req, env))) return json({ ok: false, error: 'Không có quyền.' }, 401);
    const b = await req.json();
    const newPassword = String(b.newPassword ?? '').trim();
    if (newPassword.length < 8) return json({ ok: false, error: 'Mật khẩu mới phải có ít nhất 8 ký tự.' }, 400);
    if (newPassword.length > 128) return json({ ok: false, error: 'Mật khẩu mới quá dài.' }, 400);
    const salt = randomHex(16);
    const passwordHash = await hashPassword(newPassword, salt);
    const tokenHash = await sha256(newPassword);
    const r = await env.DB.prepare(
      "UPDATE admin_credentials SET password_hash=?,salt=?,token_hash=?,updated_at=datetime('now') WHERE id=1"
    ).bind(passwordHash, salt, tokenHash).run();
    if (r.meta.changes !== 1) return json({ ok: false, error: 'Không thể đổi mật khẩu quản trị.' }, 500);
    return json({ ok: true, token: tokenHash, message: 'Đã đổi mật khẩu quản trị thành công.' });
  }

  // Quán dùng endpoint này sau khi kiểm tra điều kiện tại chỗ.
  // unlockType chỉ nhận 2 hoặc 3; mã có hiệu lực 10 phút và chỉ dùng một lần.
  if (url.pathname === '/api/admin/unlock' && req.method === 'POST') {
    if (!(await adminOk(req, env))) return json({ ok: false, error: 'Không có quyền.' }, 401);
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
    if (!(await adminOk(req, env))) return json({ ok: false, error: 'Không có quyền.' }, 401);
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
    if (!(await adminOk(req, env))) return json({ ok: false, error: 'Không có quyền.' }, 401);

    await env.DB.batch([
      env.DB.prepare('DELETE FROM customer_unlocks'),
      env.DB.prepare('DELETE FROM unlock_tokens'),
      env.DB.prepare('DELETE FROM plays'),
      env.DB.prepare('DELETE FROM customers')
    ]);

    return json({ ok: true, message: 'Đã xóa toàn bộ khách hàng và dữ liệu liên quan.' });
  }

  if (url.pathname === '/api/admin/plays' && req.method === 'GET') {
    if (!(await adminOk(req, env))) return json({ ok: false, error: 'Không có quyền.' }, 401);
    const rows = await env.DB.prepare(
      'SELECT plays.id,customers.name,customers.phone,plays.play_date,plays.prize_name,plays.reward_code,plays.redeemed,plays.redemption_count,plays.redeemed_at,plays.expires_at,plays.created_at FROM plays JOIN customers ON customers.id=plays.customer_id ORDER BY plays.id DESC LIMIT 500'
    ).all();
    return json({ ok: true, rows: rows.results });
  }

  if (url.pathname === '/api/admin/redeem' && req.method === 'POST') {
    if (!(await adminOk(req, env))) return json({ ok: false, error: 'Không có quyền.' }, 401);
    const b = await req.json();
    const code = String(b.code || '').trim();
    const reward = await env.DB.prepare(
      'SELECT id,prize_index,redemption_count,expires_at FROM plays WHERE reward_code=?'
    ).bind(code).first();
    if (!reward) return json({ ok: false, error: 'Mã không hợp lệ.' }, 400);
    const count = Number(reward.redemption_count || 0);
    const max = maxRedemptions(reward.prize_index);
    if (reward.expires_at && new Date(reward.expires_at).getTime() <= Date.now())
      return json({ ok: false, error: 'Mã đã quá hạn.' }, 400);
    if (count >= max)
      return json({ ok: false, error: max === 2 ? 'Giải đặc biệt này đã được đổi đủ 2 lần.' : 'Mã đã được đổi quà.' }, 400);
    const r = await env.DB.prepare(
      "UPDATE plays SET redeemed=?,redemption_count=?,redeemed_at=datetime('now') WHERE id=? AND redemption_count=?"
    ).bind(count + 1 >= max ? 1 : 0, count + 1, reward.id, count).run();
    if (r.meta.changes !== 1) return json({ ok: false, error: 'Mã vừa được xử lý bởi một nhân viên khác. Vui lòng kiểm tra lại.' }, 409);
    return json({ ok: true, redemptionCount: count + 1, maxRedemptions: max, remainingRedemptions: max - count - 1 });
  }

  if (url.pathname === '/api/reward' && req.method === 'GET') {
    const codeVal = url.searchParams.get('code') || '';
    const r = await env.DB.prepare(
      'SELECT plays.reward_code,plays.prize_name,plays.prize_index,plays.redeemed,plays.redemption_count,plays.redeemed_at,plays.created_at,plays.expires_at,customers.name FROM plays JOIN customers ON customers.id=plays.customer_id WHERE plays.reward_code=?'
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
