// Stardust Hub builder: original app shell (shell.html) -> one real HTML file per URL + instant data snapshots.
// Run: node scripts/build-static.mjs   (Node >= 18, no dependencies)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const DB = (process.env.FIREBASE_DB_URL || 'https://stardust-hub-default-rtdb.firebaseio.com').replace(/\/$/, '');
const BASE = (process.env.SITE_BASE_URL || 'https://zishutron.github.io/Stardust-hub').replace(/\/$/, '');
const PFX = new URL(BASE).pathname.replace(/\/$/, '');
const ROOT = process.cwd();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeId = s => String(s).replace(/[^a-zA-Z0-9_-]/g, '');
const write = (f, c) => { const p = path.join(ROOT, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); };
const get = async n => {
  if (process.env.DATA_FILE) return JSON.parse(fs.readFileSync(process.env.DATA_FILE, 'utf8'))[n] || {};
  const j = await (await fetch(`${DB}/${n}.json`)).json();
  if (j && j.error) throw new Error(`Firebase /${n}: "${j.error}". Is public read enabled for /${n} in Realtime Database rules?`);
  return j || {};
};
const [rawPosts, rawReels] = await Promise.all([get('publications'), get('reels')]);

// Old posts keep the image as base64 inside the database (the main reason for slow loading). Turn them into real files.
function media(id, src) {
  const m = /^data:image\/(\w+);base64,(.+)$/s.exec(src || '');
  if (!m) return src || null;
  const f = `media/p/${id}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  write(f, Buffer.from(m[2], 'base64'));
  return f; // relative; <base href> resolves it
}
const posts = Object.values(rawPosts).filter(p => p && p.id && (p.text || p.image))
  .map(p => ({ ...p, id: safeId(p.id), image: media(safeId(p.id), p.image) })).sort((a, b) => b.timestamp - a.timestamp);
const reels = Object.values(rawReels).filter(r => r && r.id && r.videoUrl)
  .map(r => ({ ...r, id: safeId(r.id) })).sort((a, b) => b.createdAt - a.createdAt);

// Instant-load snapshots (full objects, so likes/comments/avatars render exactly like the live data).
write('data/feed.json', JSON.stringify(posts.slice(0, 40)));
write('data/reels.json', JSON.stringify(reels.slice(0, 40)));

const V = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'assets/app.js'))).update(fs.readFileSync(path.join(ROOT, 'assets/app.css'))).digest('hex').slice(0, 8);
const shell = fs.readFileSync(path.join(ROOT, 'shell.html'), 'utf8').replaceAll('{{V}}', V);
const abs = u => (u && !/^https?:/.test(u) ? `${BASE}/${u}` : u);
const page = ({ file, url, title, desc = 'Stardust Hub - Where Connections Shine Like Stars', img, video, type = 'website', pub = '', noindex = false }) => {
  const head = `<title>${esc(title)}</title><meta name="description" content="${esc(desc).slice(0, 200)}"><base href="${PFX}/"><link rel="canonical" href="${BASE}${url}">${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:site_name" content="Stardust Hub"><meta property="og:type" content="${type}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc).slice(0, 200)}"><meta property="og:url" content="${BASE}${url}">${img ? `<meta property="og:image" content="${esc(abs(img))}"><meta name="twitter:card" content="summary_large_image">` : ''}${video ? `<meta property="og:video" content="${esc(video)}">` : ''}`;
  write(file, shell.replace('<!--HEAD-->', head).replace('<!--PUBLIC-->', pub));
};
const publicView = inner => `<div id="public-view" style="display:none" class="fixed inset-0 z-40 overflow-y-auto bg-lightbg"><div class="max-w-md mx-auto p-4 space-y-4"><div class="flex justify-between items-center"><a href="./" class="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-400">STARDUST</a><button onclick="openLoginFromPublic()" class="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-full">Login / Sign up</button></div>${inner}<p class="text-center text-xs text-slate-500">Login to like, comment and share.</p></div></div>`;
const who = (n, a, uid) => `<a href="u/${uid}/" class="flex items-center gap-3"><img src="${esc(a)}" class="w-10 h-10 rounded-full object-cover" alt=""><b class="text-sm text-slate-800">${esc(n)}</b></a>`;
const card = inner => `<div class="bg-white rounded-2xl border border-lightborder p-4 space-y-3 text-sm text-slate-800">${inner}</div>`;
const short = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 60);

// App tabs (same app, one URL each)
page({ file: 'index.html', url: '/', title: 'Stardust Hub - Social media' });
page({ file: 'reels/index.html', url: '/reels/', title: 'Reels | Stardust Hub' });
page({ file: 'search/index.html', url: '/search/', title: 'Search | Stardust Hub', noindex: true });
page({ file: 'chat/index.html', url: '/chat/', title: 'Chat | Stardust Hub', noindex: true });
page({ file: 'profile/index.html', url: '/profile/', title: 'Profile | Stardust Hub', noindex: true });
page({ file: '404.html', url: '/', title: 'Stardust Hub', noindex: true });
// One URL per post / video / profile
for (const p of posts) page({ file: `post/${p.id}/index.html`, url: `/post/${p.id}/`, title: `${p.authorName} on Stardust: ${short(p.text) || 'Photo'}`, desc: p.text || `Post by ${p.authorName}`, img: p.image, type: 'article',
  pub: publicView(card(`${who(p.authorName, p.authorAvatar, p.authorUID)}${p.text ? `<p style="white-space:pre-wrap">${esc(p.text)}</p>` : ''}${p.image ? `<img src="${esc(p.image)}" class="w-full rounded-xl" alt="">` : ''}`)) });
for (const r of reels) page({ file: `video/${r.id}/index.html`, url: `/video/${r.id}/`, title: `${r.userName} on Stardust: ${short(r.caption) || 'Video'}`, desc: r.caption || `Video by ${r.userName}`, img: r.thumbnail, video: r.videoUrl, type: 'video.other',
  pub: publicView(card(`${who(r.userName, r.userAvatar, r.userId)}<video controls playsinline preload="metadata" poster="${esc(r.thumbnail)}" src="${esc(r.videoUrl)}" class="w-full rounded-xl bg-black"></video>${r.caption ? `<p>${esc(r.caption)}</p>` : ''}`)) });
const users = {};
posts.forEach(p => (users[safeId(p.authorUID)] ||= { n: p.authorName, a: p.authorAvatar, p: [], r: [] }).p.push(p));
reels.forEach(r => (users[safeId(r.userId)] ||= { n: r.userName, a: r.userAvatar, p: [], r: [] }).r.push(r));
for (const [uid, u] of Object.entries(users)) if (uid) page({ file: `u/${uid}/index.html`, url: `/u/${uid}/`, title: `${u.n} (@${uid}) | Stardust Hub`, img: u.a,
  pub: publicView(card(`${who(u.n, u.a, uid)}<p class="text-xs text-slate-500">${u.p.length} posts · ${u.r.length} videos</p>`) + u.r.slice(0, 12).map(r => `<a href="video/${r.id}/">${card(`<img src="${esc(r.thumbnail)}" class="w-full rounded-xl" alt=""><p>${esc(short(r.caption))}</p>`)}</a>`).join('') + u.p.slice(0, 20).map(p => `<a href="post/${p.id}/">${card(`<p>${esc(short(p.text))}</p>${p.image ? `<img src="${esc(p.image)}" class="w-full rounded-xl" alt="">` : ''}`)}</a>`).join('')) });

const urls = ['/', '/reels/', ...posts.map(p => `/post/${p.id}/`), ...reels.map(r => `/video/${r.id}/`), ...Object.keys(users).filter(Boolean).map(u => `/u/${u}/`)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${BASE}${u}</loc></url>`).join('')}</urlset>`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);
console.log(`Built ${posts.length} posts, ${reels.length} videos, ${Object.keys(users).length} profiles (assets v${V})`);
