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

if (!Object.keys(rawPosts).length && !Object.keys(rawReels).length && !process.env.ALLOW_EMPTY && fs.existsSync(path.join(ROOT, 'data/feed.json')) && fs.readFileSync(path.join(ROOT, 'data/feed.json'), 'utf8').length > 2)
  throw new Error('Firebase returned 0 posts and 0 videos but the site already has content. Refusing to publish an empty site (ALLOW_EMPTY=1 overrides).');

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


// ---- Baked first paint (like the store): real content is in the HTML before any JavaScript or Firebase runs.
const ICON = { like: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', comment: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', share: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z', save: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z' };
const ico = d => `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${d}"/></svg>`;
const DEF_AV = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
const cnt = o => (o && typeof o === 'object') ? Object.keys(o).length : 0;
const bakedPost = p => `<div class="bg-lightcard dark:bg-darkcard rounded-2xl border border-lightborder dark:border-slate-800/80 p-4 space-y-3 text-xs shadow-md relative">
<a href="u/${safeId(p.authorUID)}/" class="flex items-center space-x-2.5"><img src="${esc(p.authorAvatar || DEF_AV)}" class="w-8 h-8 rounded-full object-cover border border-slate-300 dark:border-slate-700" alt=""><div><h4 class="font-bold text-slate-800 dark:text-slate-200">${esc(p.authorName || 'Unknown')}</h4><p class="text-[9px] text-slate-500 font-mono">@${esc(p.authorUID || 'unknown')} • ${p.timestamp ? new Date(p.timestamp).toISOString().slice(0, 10) : ''}</p></div></a>
<a href="post/${p.id}/" class="block space-y-3"><p class="text-slate-700 dark:text-slate-300 leading-relaxed break-words">${esc(p.text || '')}</p>${p.image ? `<div class="w-full max-h-52 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800"><img src="${esc(p.image)}" alt="Post image" class="w-full h-full object-cover"></div>` : ''}</a>
<div class="flex items-center justify-between pt-2 border-t border-slate-300 dark:border-slate-800/60 text-slate-500"><span class="flex items-center space-x-1.5">${ico(ICON.like)}<span>${cnt(p.likes)}</span></span><span class="flex items-center space-x-1.5">${ico(ICON.comment)}<span>${cnt(p.comments)}</span></span><span class="flex items-center space-x-1.5">${ico(ICON.share)}</span><span class="flex items-center space-x-1.5">${ico(ICON.save)}</span></div></div>`;
const bakedReel = r => `<a href="video/${r.id}/" class="block relative rounded-xl overflow-hidden bg-black aspect-[9/16]"><img src="${esc(r.thumbnail || '')}" class="w-full h-full object-cover" alt="${esc(short(r.caption))}"><span class="absolute bottom-1 left-1 right-1 text-[10px] text-white font-bold truncate">${esc(r.userName)}</span></a>`;
// bottom navigation: the app's own nav markup, turned into real links
const NAV = (shell.match(/<nav class="[\s\S]*?<\/nav>/) || [''])[0].replace(/<button onclick="switchTab\('(\w+)'\)"/g, (_, t) => `<a href="${{ home: '', chat: 'chat/', reels: 'reels/', search: 'search/', profile: 'profile/' }[t]}"`).replace(/<\/button>/g, '</a>');
const bakedView = inner => `<div id="public-view" style="position:fixed;inset:0;z-index:110;overflow-y:auto" class="bg-lightbg dark:bg-darkbg"><div class="max-w-md mx-auto w-full px-4 pb-24"><header class="py-4 flex justify-between items-center"><span class="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-400">STARDUST</span><button onclick="openLoginFromPublic()" class="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-full">Login</button></header>${inner}</div>${NAV}</div>
<script>addEventListener('DOMContentLoaded',function(){var a=document.getElementById('app-layout'),p=document.getElementById('public-view');if(a&&p)new MutationObserver(function(){if(!a.classList.contains('hidden'))p.style.display='none'}).observe(a,{attributes:true,attributeFilter:['class']})})</script>`;

// App tabs (same app, one URL each)
page({ file: 'index.html', url: '/', title: 'Stardust Hub - Social media', pub: bakedView(`<div class="space-y-4">${posts.slice(0, 20).map(bakedPost).join('')}</div>`) });
page({ file: 'reels/index.html', url: '/reels/', title: 'Reels | Stardust Hub', pub: bakedView(`<div class="grid grid-cols-2 gap-2">${reels.slice(0, 20).map(bakedReel).join('')}</div>`) });
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
