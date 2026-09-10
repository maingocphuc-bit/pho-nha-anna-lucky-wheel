import QRCode from 'qrcode';

const PRIZES = [
  {name:'1 Tô Phở Ăn Miễn Phí', odds:5, special:true},
  {name:'Giảm giá 5K', odds:10, special:false},
  {name:'1 Ly Sữa Tươi Mát Lạnh', odds:15, special:false},
  {name:'1 Ly Trà Gừng Mát Lạnh', odds:20, special:false},
  {name:'Chúc Bạn May Mắn Lần Sau', odds:50, special:false}
];
const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, X-Admin-Token','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json; charset=utf-8'}})}
function normPhone(v){return String(v||'').replace(/\D/g,'')}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date())}
function code(){return 'ANNA-'+crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase()}
function weightedPick(){let r=Math.random()*100;for(let i=0;i<PRIZES.length;i++){if(r<PRIZES[i].odds)return i;r-=PRIZES[i].odds}return PRIZES.length-1}
async function sha256(text){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function adminOk(req,env){const token=req.headers.get('X-Admin-Token')||'';if(!token||!env.ADMIN_PASSWORD)return false;return token===await sha256(env.ADMIN_PASSWORD)}
async function api(req,env,url){
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(url.pathname==='/api/register'&&req.method==='POST'){
    const b=await req.json(); const name=String(b.name||'').trim(); const phone=normPhone(b.phone);
    if(name.length<2||phone.length<9||phone.length>12)return json({ok:false,error:'Tên hoặc số điện thoại không hợp lệ.'},400);
    await env.DB.prepare("INSERT INTO customers(name,phone) VALUES(?,?) ON CONFLICT(phone) DO UPDATE SET name=excluded.name,updated_at=datetime('now')").bind(name,phone).run();
    const c=await env.DB.prepare('SELECT id,name,phone FROM customers WHERE phone=?').bind(phone).first();
    const d=today(); const row=await env.DB.prepare('SELECT COUNT(*) AS n FROM plays WHERE customer_id=? AND play_date=?').bind(c.id,d).first();
    return json({ok:true,customer:{id:c.id,name:c.name},used:Number(row.n||0),remaining:Math.max(0,3-Number(row.n||0))});
  }
  if(url.pathname==='/api/spin'&&req.method==='POST'){
    const b=await req.json();const phone=normPhone(b.phone);if(phone.length<9||phone.length>12)return json({ok:false,error:'Số điện thoại không hợp lệ.'},400);
    const c=await env.DB.prepare('SELECT id,name FROM customers WHERE phone=?').bind(phone).first();if(!c)return json({ok:false,error:'Khách chưa đăng ký.'},404);
    const d=today();const row=await env.DB.prepare('SELECT COUNT(*) AS n FROM plays WHERE customer_id=? AND play_date=?').bind(c.id,d).first();const used=Number(row.n||0);if(used>=3)return json({ok:false,error:'Hôm nay khách đã hết 3 lượt quay.'},429);
    const i=weightedPick();const rewardCode=code();const p=PRIZES[i];await env.DB.prepare('INSERT INTO plays(customer_id,play_date,prize_index,prize_name,reward_code) VALUES(?,?,?,?,?)').bind(c.id,d,i,p.name,rewardCode).run();
    const qr=await QRCode.toDataURL(rewardCode,{margin:1,width:260});
    return json({ok:true,prizeIndex:i,prize:p.name,special:p.special,rewardCode,qr,remaining:2-used});
  }
  if(url.pathname==='/api/admin/login'&&req.method==='POST'){
    const b=await req.json();if(!env.ADMIN_PASSWORD||String(b.password||'')!==env.ADMIN_PASSWORD)return json({ok:false,error:'Sai mật khẩu.'},401);return json({ok:true,token:await sha256(env.ADMIN_PASSWORD)});
  }
  if(url.pathname==='/api/admin/plays'&&req.method==='GET'){
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);const rows=await env.DB.prepare('SELECT plays.id,customers.name,customers.phone,plays.play_date,plays.prize_name,plays.reward_code,plays.redeemed,plays.redeemed_at,plays.created_at FROM plays JOIN customers ON customers.id=plays.customer_id ORDER BY plays.id DESC LIMIT 500').all();return json({ok:true,rows:rows.results});
  }
  if(url.pathname==='/api/admin/redeem'&&req.method==='POST'){
    if(!(await adminOk(req,env)))return json({ok:false,error:'Không có quyền.'},401);const b=await req.json();const r=await env.DB.prepare("UPDATE plays SET redeemed=1,redeemed_at=datetime('now') WHERE reward_code=? AND redeemed=0").bind(String(b.code||'')).run();return json({ok:r.meta.changes===1});
  }
  if(url.pathname==='/api/reward'&&req.method==='GET'){
    const codeVal=url.searchParams.get('code')||'';const r=await env.DB.prepare('SELECT plays.reward_code,plays.prize_name,plays.redeemed,plays.redeemed_at,customers.name FROM plays JOIN customers ON customers.id=plays.customer_id WHERE plays.reward_code=?').bind(codeVal).first();if(!r)return json({ok:false,error:'Không tìm thấy mã.'},404);return json({ok:true,reward:r});
  }
  return null;
}
export default {async fetch(req,env){const url=new URL(req.url);const r=await api(req,env,url);if(r)return r;return env.ASSETS.fetch(req)}};
