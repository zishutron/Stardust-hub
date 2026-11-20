// Stardust Hub static builder: Firebase -> real HTML pages (/post/<id>/, /video/<id>/, /u/<uid>/, /videos/, /) + feed snapshots.
// Run: node scripts/build-static.mjs   (Node >= 18, no dependencies)
import fs from 'node:fs';
import path from 'node:path';
const DB = (process.env.FIREBASE_DB_URL || 'https://stardust-hub-default-rtdb.firebaseio.com').replace(/\/$/, '');
const BASE = (process.env.SITE_BASE_URL || 'https://stardustofficial.github.io/Stardust-hub').replace(/\/$/, '');
const ROOT = process.cwd();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeId = s => String(s).replace(/[^a-zA-Z0-9_-]/g, '');
const cnt = o => (o && typeof o === 'object') ? Object.keys(o).length : 0;
const ago = t => { const d = (Date.now() - t) / 1000; return d < 60 ? 'now' : d < 3600 ? ~~(d/60) + 'm' : d < 86400 ? ~~(d/3600) + 'h' : ~~(d/86400) + 'd'; };
const write = (f, c) => { const p = path.join(ROOT, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); };
const get = async n => process.env.DATA_FILE ? (JSON.parse(fs.readFileSync(process.env.DATA_FILE, 'utf8'))[n] || {}) : (await (await fetch(`${DB}/${n}.json`)).json()) || {};

// Only public content is fetched. /users is NOT read (it holds email/phone); name+avatar are already stored on each post/reel.
const [rawPosts, rawReels] = await Promise.all([get('publications'), get('reels')]);

// Old posts keep images as base64 inside the DB (that is why the app is slow). Move them to real files.
function media(id, src) {
  const m = /^data:image\/(\w+);base64,(.+)$/s.exec(src || '');
  if (!m) return src || null;
  const f = `media/p/${id}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  write(f, Buffer.from(m[2], 'base64'));
  return `/${f}`;
}
const posts = Object.values(rawPosts).filter(p => p && p.id && (p.text || p.image)).map(p => {
  const id = safeId(p.id);
  return { id, uid: safeId(p.authorUID || ''), name: p.authorName || 'User', av: p.authorAvatar || '', text: p.text || '', img: media(id, p.image), t: p.timestamp || 0, likes: cnt(p.likes), comments: cnt(p.comments) };
}).sort((a, b) => b.t - a.t);
const reels = Object.values(rawReels).filter(r => r && r.id && r.videoUrl).map(r => ({
  id: safeId(r.id), uid: safeId(r.userId || ''), name: r.userName || 'User', av: r.userAvatar || '', url: r.videoUrl, thumb: r.thumbnail || '', text: r.caption || '', t: r.createdAt || 0, likes: cnt(r.likes), comments: cnt(r.comments), views: r.views || 0
})).sort((a, b) => b.t - a.t);

const shell = ({ title, desc = 'Stardust Hub - Where Connections Shine Like Stars', url, img, video, body, type = 'website' }) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc).slice(0, 200)}"><link rel="canonical" href="${BASE}${url}">
<meta property="og:site_name" content="Stardust Hub"><meta property="og:type" content="${type}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc).slice(0, 200)}"><meta property="og:url" content="${BASE}${url}">
${img ? `<meta property="og:image" content="${esc(img.startsWith('http') ? img : BASE + img)}"><meta name="twitter:card" content="summary_large_image">` : ''}${video ? `<meta property="og:video" content="${esc(video)}">` : ''}
<link rel="stylesheet" href="/assets/site.css"></head><body>
<header class="top"><a class="logo" href="/">STARDUST</a><a class="btn" href="/app/">Open App</a></header>
<main class="wrap">${body}</main>
<nav class="bar"><a href="/">Home</a><a href="/videos/">Videos</a><a href="/app/#chat">Chat</a><a href="/app/#profile">Profile</a></nav></body></html>`;

const head = (o, href) => `<div class="hd"><img class="av" loading="lazy" src="${esc(o.av)}" alt=""><div><a href="/u/${o.uid}/"><b>${esc(o.name)}</b></a><div class="meta">${ago(o.t)}</div></div></div>`;
const foot = (o, href) => `<a class="ft" href="${href}"><span>❤ ${o.likes}</span><span>💬 ${o.comments}</span>${o.views != null ? `<span>👁 ${o.views}</span>` : ''}</a>`;
const postCard = p => `<article class="card">${head(p)}${p.text ? `<p>${esc(p.text)}</p>` : ''}${p.img ? `<a href="/post/${p.id}/"><img class="m" loading="lazy" src="${esc(p.img)}" alt=""></a>` : ''}${foot(p, `/post/${p.id}/`)}</article>`;
const reelTile = r => `<a href="/video/${r.id}/"><img loading="lazy" src="${esc(r.thumb)}" alt="${esc(r.text).slice(0, 60)}"></a>`;
const sec = s => s.replace(/\s+/g, ' ').trim();

for (const p of posts) write(`post/${p.id}/index.html`, shell({ title: `${p.name} on Stardust: ${sec(p.text).slice(0, 60) || 'Photo'}`, desc: p.text || `Post by ${p.name}`, url: `/post/${p.id}/`, img: p.img, type: 'article', body: postCard(p) + `<p class="meta"><a href="/">← Back to feed</a></p>` }));
for (const r of reels) write(`video/${r.id}/index.html`, shell({ title: `${r.name} on Stardust: ${sec(r.text).slice(0, 60) || 'Video'}`, desc: r.text || `Video by ${r.name}`, url: `/video/${r.id}/`, img: r.thumb, video: r.url, type: 'video.other',
  body: `<article class="card">${head(r)}<video controls playsinline preload="metadata" poster="${esc(r.thumb)}" src="${esc(r.url)}"></video>${r.text ? `<p style="padding-top:12px">${esc(r.text)}</p>` : ''}${foot(r, `/app/#reel=${r.id}`)}</article><p class="meta"><a href="/videos/">← More videos</a></p>` }));
const byUser = {};
[...posts, ...reels].forEach(x => (byUser[x.uid] ||= { name: x.name, av: x.av, posts: [], reels: [] }));
posts.forEach(p => byUser[p.uid].posts.push(p)); reels.forEach(r => byUser[r.uid].reels.push(r));
for (const [uid, u] of Object.entries(byUser)) if (uid) write(`u/${uid}/index.html`, shell({ title: `${u.name} (@${uid}) | Stardust Hub`, url: `/u/${uid}/`, img: u.av,
  body: `<div class="card hd"><img class="av" style="width:64px;height:64px" src="${esc(u.av)}" alt=""><div><h1 style="margin:0">${esc(u.name)}</h1><div class="meta">@${uid} · ${u.posts.length} posts · ${u.reels.length} videos</div></div></div>${u.reels.length ? `<div class="grid">${u.reels.map(reelTile).join('')}</div>` : ''}${u.posts.slice(0, 30).map(postCard).join('')}` }));
write('videos/index.html', shell({ title: 'Videos | Stardust Hub', url: '/videos/', body: `<h1>Videos</h1><div class="grid">${reels.slice(0, 60).map(reelTile).join('')}</div>` }));
write('index.html', shell({ title: 'Stardust Hub - Social media', url: '/', body: `<div id="feed">${posts.slice(0, 20).map(postCard).join('') || '<p class="meta">No posts yet.</p>'}</div>` }));
write('404.html', shell({ title: 'Not found | Stardust Hub', url: '/404.html', body: '<h1>Page not found</h1><p><a class="btn" href="/">Go home</a></p>' }));

// Snapshots: tiny JSON the app can load from CDN (no Firebase round trip, no base64).
write('data/feed.json', JSON.stringify(posts.slice(0, 50).map(({ text, ...p }) => ({ ...p, text: text.slice(0, 500) }))));
write('data/videos.json', JSON.stringify(reels.slice(0, 50)));
const urls = ['/', '/videos/', ...posts.map(p => `/post/${p.id}/`), ...reels.map(r => `/video/${r.id}/`), ...Object.keys(byUser).filter(Boolean).map(u => `/u/${u}/`)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${BASE}${u}</loc></url>`).join('')}</urlset>`);
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /app/\nSitemap: ${BASE}/sitemap.xml\n`);
console.log(`Built ${posts.length} posts, ${reels.length} videos, ${Object.keys(byUser).length} profiles`);
