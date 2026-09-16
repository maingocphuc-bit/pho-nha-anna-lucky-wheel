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

const REGULAR_QUOTAS = { 2: 6, 3: 4, 4: 25 };
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
}
function normPhone(v) { return String(v || '').replace(/\D/g, ''); }
function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()); }
function tokenCode(prefix = 'ANNA') { return prefix + '-' + crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase(); }
function makeQrDataUrl(text) {
  const svg = new QRCode({ content: text, padding: 4, width: 360, height: 360, color: '#000000', background: '#ffffff', ecl: 'H' }).svg();
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
async function sha256(text) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const PBKDF2_ITERATIONS = 120000;
function randomHex(bytes = 16) {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return [...a].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function hashPassword(password, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/.{1,2}/g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function getAdminAccount(env) {
  return await env.DB.prepare('SELECT id,password_hash,salt,token_hash FROM admin_credentials WHERE id=1').first();
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
  const supplied = req.headers.get('X-Admin-Token') || '';
  if (!supplied) return false;
  const account = await getAdminAccount(env);
  return !!(account && supplied === account.token_hash);
}
async function ensureCycle600(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS cycle_state_600 (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    cycle_no INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 600),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  await env.DB.prepare("INSERT OR IGNORE INTO cycle_state_600(id,cycle_no,position) VALUES(1,1,0)").run();
}
async function customerUnlocks(env, customerId, date) {
  const rows = await env.DB.prepare('SELECT unlock_type FROM customer_unlocks WHERE customer_id=? AND unlock_date=?').bind(customerId, date).all();
  const types = new Set((rows.results || []).map(r => Number(r.unlock_type)));
  return { unlock2: types.has(2), unlock3: types.has(3) };
}
function specialExpires(prizeIndex, date) {
  if (prizeIndex === 0) return new Date(Date.now() + 7 * 86400000).toISOString();
  if (prizeIndex === 1) return new Date(Date.now() + 2 * 86400000).toISOString();
  return new Date(`${date}T23:59:59+07:00`).toISOString();
}
function chooseRegular(counts) {
  const available = Object.entries(REGULAR_QUOTAS)
    .map(([idx, quota]) => ({ i: Number(idx), left: quota - Number(counts[idx] || 0) }))
    .filter(x => x.left > 0);
  const totalLeft = available.reduce((s, x) => s + x.left, 0);
  if (!totalLeft) return 5;
  let r = Math.random() * totalLeft;
  for (const x of available) {
    if (r < x.left) return x.i;
    r -= x.left;
  }
  return available[available.length - 1].i;
}
async function reserveCyclePosition(env) {
  const result = await env.DB.prepare(`
    UPDATE cycle_state_600
    SET cycle_no = CASE WHEN position >= 600 THEN cycle_no + 1 ELSE cycle_no END,
        position = CASE WHEN position >= 600 THEN 1 ELSE position + 1 END,
        updated_at = datetime('now')
    WHERE id=1
    RETURNING cycle_no, position
  `).run();
  return result?.results?.[0] || null;
}
async function specialHistory(env, customerId) {
  const rows = await env.DB.prepare('SELECT DISTINCT prize_index FROM plays WHERE customer_id=? AND prize_index IN (0,1)').bind(customerId).all();
  const set = new Set((rows.results || []).map(x => Number(x.prize_index)));
  return { has0: set.has(0), has1: set.has(1) };
}

async function api(req, env, url) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (url.pathname === '/api/register' && req.method === 'POST') {
    const b = await req.json(); const name = String(b.name || '').trim(); const phone = normPhone(b.phone);
    if (name.length < 2 || phone.length < 9 || phone.length > 12) return json({ ok:false, error:'Tên hoặc số điện thoại không hợp lệ.' },400);
    await env.DB.prepare("INSERT INTO customers(name,phone) VALUES(?,?) ON CONFLICT(phone) DO UPDATE SET name=excluded.name,updated_at=datetime('now')").bind(name,phone).run();
    const c = await env.DB.prepare('SELECT id,name,phone FROM customers WHERE phone=?').bind(phone).first();
    const d = today(); const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM plays WHERE customer_id=? AND play_date=?').bind(c.id,d).first();
    const unlocks = await customerUnlocks(env,c.id,d); const used = Number(row?.n || 0);
    return json({ ok:true, customer:{id:c.id,name:c.name}, used, remaining:Math.max(0,3-used), ...unlocks });
  }

  if (url.pathname === '/api/spin' && req.method === 'POST') {
    const b = await req.json(); const phone = normPhone(b.phone);
    if (phone.length < 9 || phone.length > 12) return json({ok:false,error:'Số điện thoại không hợp lệ.'},400);
    const c = await env.DB.prepare('SELECT id,name FROM customers WHERE phone=?').bind(phone).first();
    if (!c) return json({ok:false,error:'Khách chưa đăng ký.'},404);
    const d = today();
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM plays WHERE customer_id=? AND play_date=?').bind(c.id,d).first();
    const used = Number(row?.n || 0); const unlocks = await customerUnlocks(env,c.id,d);
    if (used >= 3) return json({ok:false,error:'Hôm nay khách đã hết 3 lượt quay.'},429);
    if (used === 1 && !unlocks.unlock2) return json({ok:false,code:'LOCKED_2',error:'Lượt 2 cần được quán xác nhận mở khóa tại chỗ.',...unlocks},403);
    if (used === 2 && !unlocks.unlock3) return json({ok:false,code:'LOCKED_3',error:'Lượt 3 cần được quán xác nhận mở khóa tại chỗ.',...unlocks},403);

    const history = await specialHistory(env,c.id);
    await ensureCycle600(env);
    const reserved = await reserveCyclePosition(env);
    if (!reserved) return json({ok:false,error:'Không thể cấp lượt trong bộ đếm 600.'},500);
    const cycleNo = Number(reserved.cycle_no), cyclePosition = Number(reserved.position);

    const rows = await env.DB.prepare('SELECT id,customer_id,prize_index,redeemed FROM plays WHERE cycle600_no=? ORDER BY cycle600_position ASC').bind(cycleNo).all();
    const cycleRows = rows.results || [];
    const counts = [0,0,0,0,0,0];
    for (const r of cycleRows) { const idx=Number(r.prize_index); if(idx>=0&&idx<6) counts[idx]++; }

    const eligibleFor = async (specialIndex) => {
      return !(specialIndex===0 ? history.has1 : history.has0);
    };

    let i;
    // 310 và 600 là vị trí ưu tiên. Nếu người trúng không đủ điều kiện, hệ thống
    // chuyển giải đặc biệt sang lượt gần nhất đủ điều kiện để vẫn giữ 1 giải/cycle.
    if (cyclePosition === 310 || cyclePosition === 600) {
      const specialIndex = cyclePosition === 310 ? 1 : 0;
      if (await eligibleFor(specialIndex)) {
        i = specialIndex;
      } else {
        i = 5;
      }
    } else {
      // Nếu giải 50K ở vị trí 310 bị chặn, ưu tiên trao ở lượt thường gần nhất.
      const special1Awarded = cycleRows.some(r => Number(r.prize_index)===1);
      const special0Awarded = cycleRows.some(r => Number(r.prize_index)===0);
      if (!special1Awarded && cyclePosition > 310 && await eligibleFor(1)) i = 1;
      else if (!special0Awarded && cyclePosition === 600 && await eligibleFor(0)) i = 0;
      else {
        i = chooseRegular(counts);
      }
    }

    // Không cho một khách sở hữu cả hai giải đặc biệt.
    if ((i===0 && history.has1) || (i===1 && history.has0)) i = 5;

    const rewardCode = tokenCode('ANNA'); const p = PRIZES[i]; const expiresAt = specialExpires(i,d);
    await env.DB.prepare(`INSERT INTO plays
      (customer_id,play_date,prize_index,prize_name,reward_code,expires_at,cycle_no,cycle_position,cycle600_no,cycle600_position)
      VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .bind(c.id,d,i,p.name,rewardCode,expiresAt,cycleNo,cyclePosition,cycleNo,cyclePosition).run();
    let qr; try { qr=makeQrDataUrl(rewardCode); } catch(e) { console.error(e); return json({ok:false,error:'Tạo mã QR thất bại.'},500); }
    return json({ok:true,prizeIndex:i,prize:p.name,special:p.special,rewardCode,qr,
      specialTerms:i===0?'Có hiệu lực 7 ngày; tối đa 1 tô/ngày; giá trị tối đa 50.000đ/tô; phần vượt quá khách tự thanh toán.':i===1?'Có hiệu lực 2 ngày; áp dụng cho 1 tô phở tối đa 50.000đ.':'',
      remaining:Math.max(0,3-(used+1)),cycleNo,cyclePosition});
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
    const d=today(); const existing=await env.DB.prepare('SELECT id FROM customer_unlocks WHERE customer_id=? AND unlock_type=? AND unlock_date=?').bind(c.id,t.unlock_type,d).first();
    if(existing)return json({ok:false,error:'Lượt này đã được mở khóa hôm nay.'},409);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO customer_unlocks(customer_id,unlock_type,unlock_date,token,created_at) VALUES(?,?,?,?,datetime('now'))").bind(c.id,t.unlock_type,d,token),
      env.DB.prepare("UPDATE unlock_tokens SET status='used',used_at=datetime('now') WHERE id=?").bind(t.id)
    ]);
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
    return json({ok:true,token:account.token_hash});
  }

  if (url.pathname === '/api/admin/status' && req.method === 'GET') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    await ensureCycle600(env);
    const state=await env.DB.prepare('SELECT cycle_no,position,updated_at FROM cycle_state_600 WHERE id=1').first();
    const total=await env.DB.prepare('SELECT COUNT(*) AS n FROM plays').first();
    const cycle=await env.DB.prepare('SELECT COUNT(*) AS n FROM plays WHERE cycle600_no=?').bind(Number(state.cycle_no)).first();
    return json({ok:true,cycleNo:Number(state.cycle_no),currentPosition:Number(state.position),cyclePlays:Number(cycle?.n||0),totalPlays:Number(total?.n||0),updatedAt:state.updated_at||null});
  }

  if (url.pathname === '/api/admin/change-password' && req.method === 'POST') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    const b=await req.json(); const p=String(b.newPassword??'').trim();
    if(p.length<8)return json({ok:false,error:'Mật khẩu mới phải có ít nhất 8 ký tự.'},400);
    if(p.length>128)return json({ok:false,error:'Mật khẩu mới quá dài.'},400);
    const salt=randomHex(16); const ph=await hashPassword(p,salt); const th=await sha256(p);
    const r=await env.DB.prepare("UPDATE admin_credentials SET password_hash=?,salt=?,token_hash=?,updated_at=datetime('now') WHERE id=1").bind(ph,salt,th).run();
    if(r.meta.changes!==1)return json({ok:false,error:'Không thể đổi mật khẩu quản trị.'},500);
    return json({ok:true,token:th,message:'Đã đổi mật khẩu quản trị thành công.'});
  }

  if (url.pathname === '/api/admin/unlock' && req.method === 'POST') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    const b=await req.json(); const phone=normPhone(b.phone); const unlockType=Number(b.unlockType);
    if(phone.length<9||phone.length>12||![2,3].includes(unlockType))return json({ok:false,error:'Số điện thoại hoặc loại lượt mở khóa không hợp lệ.'},400);
    const c=await env.DB.prepare('SELECT id FROM customers WHERE phone=?').bind(phone).first(); if(!c)return json({ok:false,error:'Khách chưa đăng ký.'},404);
    const token=tokenCode('UNLOCK'); const expires=new Date(Date.now()+10*60*1000).toISOString();
    await env.DB.prepare("INSERT INTO unlock_tokens(token,customer_id,phone,unlock_type,expires_at,status,created_at) VALUES(?,?,?,?,?,'issued',datetime('now'))").bind(token,c.id,phone,unlockType,expires).run();
    const unlockUrl=new URL(url.origin+'/'); unlockUrl.searchParams.set('unlock',token);
    return json({ok:true,token,unlockType,expiresAt:expires,url:unlockUrl.toString(),qr:makeQrDataUrl(unlockUrl.toString())});
  }

  if (url.pathname === '/api/admin/delete-customer' && req.method === 'POST') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    const phone=normPhone((await req.json()).phone); if(phone.length<9||phone.length>12)return json({ok:false,error:'Số điện thoại không hợp lệ.'},400);
    const c=await env.DB.prepare('SELECT id,name,phone FROM customers WHERE phone=?').bind(phone).first(); if(!c)return json({ok:false,error:'Không tìm thấy khách hàng.'},404);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM customer_unlocks WHERE customer_id=?').bind(c.id),
      env.DB.prepare('DELETE FROM unlock_tokens WHERE customer_id=? OR phone=?').bind(c.id,phone),
      env.DB.prepare('DELETE FROM plays WHERE customer_id=?').bind(c.id),
      env.DB.prepare('DELETE FROM customers WHERE id=?').bind(c.id)
    ]);
    return json({ok:true,message:`Đã xóa khách hàng ${c.name} (${c.phone}) và toàn bộ dữ liệu liên quan.`});
  }
  if (url.pathname === '/api/admin/delete-all-customers' && req.method === 'POST') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    await env.DB.batch([env.DB.prepare('DELETE FROM customer_unlocks'),env.DB.prepare('DELETE FROM unlock_tokens'),env.DB.prepare('DELETE FROM plays'),env.DB.prepare('DELETE FROM customers')]);
    // Xóa dữ liệu test nhưng đưa bộ đếm về đầu chu kỳ 1.
    await ensureCycle600(env);
    await env.DB.prepare("UPDATE cycle_state_600 SET cycle_no=1,position=0,updated_at=datetime('now') WHERE id=1").run();
    return json({ok:true,message:'Đã xóa toàn bộ khách hàng và dữ liệu liên quan; bộ đếm 600 đã về 0/600.'});
  }

  if (url.pathname === '/api/admin/plays' && req.method === 'GET') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
    const rows=await env.DB.prepare('SELECT plays.id,customers.name,customers.phone,plays.play_date,plays.prize_name,plays.reward_code,plays.redeemed,plays.redemption_count,plays.redeemed_at,plays.expires_at,plays.cycle600_no,plays.cycle600_position,plays.created_at FROM plays JOIN customers ON customers.id=plays.customer_id ORDER BY plays.id DESC LIMIT 500').all();
    return json({ok:true,rows:rows.results});
  }

  if (url.pathname === '/api/admin/redeem' && req.method === 'POST') {
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);
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
  try { const result=await api(req,env,url); if(result)return result; return env.ASSETS.fetch(req); }
  catch(e){ console.error('Unhandled worker error:',e); return json({ok:false,error:'Lỗi máy chủ. Vui lòng thử lại.'},500); }
} };
