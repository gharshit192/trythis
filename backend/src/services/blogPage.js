// Server-rendered blog (ADR 0018): the public journal and the web admin that
// writes it. Same design language as the share page — DM Serif Display, Work
// Sans, teal — laid out for a desktop browser first, readable on a phone.
// Everything user-facing is escaped; post HTML comes from Markdown the admin
// wrote and is trusted as-is.
const { marked } = require('marked');
const { publicBaseUrl, appUrl } = require('../utils/publicUrl');

const esc = (t) => (t == null ? '' : String(t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'));
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const slugify = (s = '') => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const render = (md = '') => marked.parse(md, { gfm: true, breaks: false });
const readingMinutes = (md = '') => Math.max(1, Math.round(String(md).split(/\s+/).filter(Boolean).length / 200));

const CSS = `
  :root { --bg:#FAF8F5; --card:#fff; --ink:#15201E; --mute:#6E7B78; --faint:#9BA5A2; --line:#E7E2DA; --teal:#0E7C7B; --teal-d:#0A5A59; --teal-soft:#E4EFEE; --sand:#E9D9BE; }
  * { box-sizing:border-box; } html { -webkit-text-size-adjust:100%; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:'Work Sans',-apple-system,system-ui,sans-serif; -webkit-font-smoothing:antialiased; line-height:1.55; }
  a { color:var(--teal); }
  .nav { display:flex; align-items:center; justify-content:space-between; max-width:1040px; margin:0 auto; padding:22px 28px; }
  .brand { font-family:'DM Serif Display',Georgia,serif; font-size:24px; color:var(--teal-d); text-decoration:none; }
  .brand small { font-family:'Work Sans',sans-serif; font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--faint); margin-left:10px; }
  .nav .cta { display:inline-block; padding:10px 16px; border-radius:12px; background:var(--teal); color:#fff; text-decoration:none; font-weight:600; font-size:14px; }
  .wrap { max-width:1040px; margin:0 auto; padding:8px 28px 60px; }
  .hero { padding:24px 0 34px; border-bottom:1px solid var(--line); margin-bottom:30px; }
  .hero h1 { font-family:'DM Serif Display',Georgia,serif; font-weight:400; font-size:clamp(34px,5vw,52px); line-height:1.05; margin:0 0 12px; max-width:720px; text-wrap:balance; }
  .hero p { font-size:17px; color:var(--mute); max-width:600px; margin:0; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:18px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:22px; text-decoration:none; color:inherit; display:flex; flex-direction:column; gap:10px; transition:transform .12s, box-shadow .12s; }
  .card:hover { transform:translateY(-2px); box-shadow:0 10px 24px rgba(21,32,30,.08); }
  .card .emoji { font-size:28px; line-height:1; }
  .card h2 { font-family:'DM Serif Display',Georgia,serif; font-weight:400; font-size:23px; line-height:1.15; margin:0; text-wrap:balance; }
  .card p { margin:0; color:var(--mute); font-size:14.5px; }
  .meta { font-size:12.5px; color:var(--faint); }
  .chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:auto; }
  .chip { font-size:12px; padding:5px 10px; border-radius:999px; background:var(--teal-soft); color:var(--teal-d); }
  .article { max-width:720px; margin:0 auto; }
  .article .eyebrow { display:flex; align-items:center; gap:10px; font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--teal); font-weight:600; margin:18px 0 12px; }
  .article h1 { font-family:'DM Serif Display',Georgia,serif; font-weight:400; font-size:clamp(32px,4.6vw,46px); line-height:1.08; margin:0 0 14px; text-wrap:balance; }
  .article .lede { font-size:18px; color:var(--mute); margin:0 0 10px; }
  .article .byline { font-size:13.5px; color:var(--faint); padding-bottom:22px; border-bottom:1px solid var(--line); margin-bottom:26px; }
  .prose { font-size:17px; }
  .prose h2 { font-family:'DM Serif Display',Georgia,serif; font-weight:400; font-size:28px; line-height:1.15; margin:36px 0 10px; }
  .prose h3 { font-size:19px; font-weight:600; margin:28px 0 8px; }
  .prose p { margin:0 0 16px; } .prose li { margin:6px 0; } .prose ul, .prose ol { padding-left:22px; margin:0 0 16px; }
  .prose blockquote { margin:20px 0; padding:14px 18px; border-left:3px solid var(--teal); background:var(--teal-soft); border-radius:0 10px 10px 0; color:var(--teal-d); }
  .prose img { max-width:100%; border-radius:12px; } .prose code { background:var(--card); border:1px solid var(--line); padding:1px 6px; border-radius:6px; font-size:.92em; }
  .prose strong { font-weight:600; }
  .get { margin:44px 0 30px; padding:26px; border-radius:16px; background:var(--teal-d); color:#fff; }
  .get h3 { font-family:'DM Serif Display',Georgia,serif; font-weight:400; font-size:26px; margin:0 0 6px; }
  .get p { margin:0 0 18px; color:rgba(255,255,255,.8); font-size:15px; }
  .get .row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .get .col { background:rgba(255,255,255,.08); border-radius:12px; padding:16px; }
  .get .col b { display:block; font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--sand); margin-bottom:8px; }
  .get .col ol { margin:0; padding-left:18px; font-size:14px; color:rgba(255,255,255,.9); } .get .col li { margin:4px 0; }
  .get .btn { display:inline-block; padding:12px 16px; border-radius:11px; background:#fff; color:var(--teal-d); font-weight:600; text-decoration:none; font-size:14.5px; }
  .get .btn.ghost { background:transparent; border:1px solid rgba(255,255,255,.4); color:#fff; }
  .related h4 { font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); margin:0 0 12px; }
  .foot { max-width:1040px; margin:0 auto; padding:18px 28px 40px; font-size:12.5px; color:var(--faint); display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  @media (max-width:640px) { .nav, .wrap, .foot { padding-left:20px; padding-right:20px; } .get .row { grid-template-columns:1fr; } .nav .cta { padding:9px 12px; } }
`;

const head = ({ title, description, url, type = 'website', extra = '' }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(url)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="Wanna Try" />
  <meta name="twitter:card" content="summary" />
  <link rel="alternate" type="application/rss+xml" title="Wanna Try Journal" href="${esc(publicBaseUrl())}/blog/feed.xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Work+Sans:wght@400;500;600&display=swap" />
  <style>${CSS}</style>
  ${extra}
</head>
<body>`;

const nav = () => `<div class="nav"><a class="brand" href="${esc(publicBaseUrl())}/blog">Wanna Try <small>Journal</small></a><a class="cta" href="${esc(appUrl())}/?signup=1&utm_source=blog">Get the app — free</a></div>`;
const foot = () => `<div class="foot"><span>© ${new Date().getFullYear()} Wanna Try · See it. Save it. Try it.</span><span><a href="${esc(publicBaseUrl())}/blog/feed.xml">RSS</a> · <a href="${esc(appUrl())}">Open the app</a></span></div></body></html>`;

// The block every post ends with: the app, and the two ways onto a phone.
const getApp = () => {
  const app = esc(appUrl());
  return `<div class="get">
    <h3>Save it before you forget it.</h3>
    <p>Wanna Try keeps the reels, links, bills and voice notes you want to act on — and brings them back when you can.</p>
    <div class="row">
      <div class="col"><b>Android</b><ol><li>Open <a href="${app}/?utm_source=blog" style="color:#fff">${app.replace(/^https?:\/\//, '')}</a> in Chrome</li><li>Tap <strong>Install app</strong> when it appears (or ⋮ → <em>Add to Home screen</em>)</li></ol><p style="margin:12px 0 0"><a class="btn" href="${app}/?utm_source=blog">Install on Android</a></p></div>
      <div class="col"><b>iPhone</b><ol><li>Open <a href="${app}/?utm_source=blog" style="color:#fff">${app.replace(/^https?:\/\//, '')}</a> in Safari</li><li>Tap the <strong>Share</strong> icon (square with an arrow)</li><li>Choose <strong>Add to Home Screen</strong></li></ol><p style="margin:12px 0 0"><a class="btn ghost" href="${app}/?utm_source=blog">Open in Safari</a></p></div>
    </div>
  </div>`;
};

const card = (p) => `<a class="card" href="${esc(publicBaseUrl())}/blog/${esc(p.slug)}">
  <span class="emoji">${esc(p.coverEmoji || '🔖')}</span>
  <h2>${esc(p.title)}</h2>
  <p>${esc(p.excerpt)}</p>
  <span class="meta">${esc(day(p.publishedAt))} · ${p.readingMinutes} min read</span>
  ${(p.keywords || []).length ? `<span class="chips">${p.keywords.slice(0, 3).map((k) => `<span class="chip">${esc(k)}</span>`).join('')}</span>` : ''}
</a>`;

function renderIndex(posts) {
  const url = `${publicBaseUrl()}/blog`;
  return `${head({ title: 'Wanna Try Journal — save reels, plan trips, never miss a bill', description: 'Notes on saving the things you find — reels, places, recipes, bills — and actually getting to them. From the team behind Wanna Try.', url })}
  ${nav()}
  <div class="wrap">
    <div class="hero"><h1>The things you save, and how to actually get to them.</h1><p>Reels you'll never scroll back to. Bills that sneak up. Trips that stay "someday". Short reads on fixing that — and what we're building.</p></div>
    ${posts.length ? `<div class="grid">${posts.map(card).join('')}</div>` : '<p style="color:var(--mute)">First post is on its way.</p>'}
  </div>
  ${foot()}`;
}

function renderPost(p, related = []) {
  const url = `${publicBaseUrl()}/blog/${p.slug}`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.excerpt, datePublished: p.publishedAt, dateModified: p.updatedAt,
    author: { '@type': 'Organization', name: p.authorName || 'Wanna Try' }, publisher: { '@type': 'Organization', name: 'Wanna Try' }, mainEntityOfPage: url, keywords: (p.keywords || []).join(', '),
  };
  return `${head({ title: `${p.title} — Wanna Try Journal`, description: p.excerpt || p.title, url, type: 'article', extra: `<script type="application/ld+json">${JSON.stringify(ld)}</script><meta property="article:published_time" content="${esc(p.publishedAt ? new Date(p.publishedAt).toISOString() : '')}" />` })}
  ${nav()}
  <div class="wrap"><article class="article">
    <div class="eyebrow"><span>${esc(p.coverEmoji || '🔖')}</span><span>${esc((p.keywords || [])[0] || 'Journal')}</span></div>
    <h1>${esc(p.title)}</h1>
    ${p.excerpt ? `<p class="lede">${esc(p.excerpt)}</p>` : ''}
    <div class="byline">${esc(p.authorName || 'Wanna Try')} · ${esc(day(p.publishedAt))} · ${p.readingMinutes} min read</div>
    <div class="prose">${p.html}</div>
    ${(p.keywords || []).length ? `<div class="chips" style="margin-top:26px">${p.keywords.map((k) => `<span class="chip">${esc(k)}</span>`).join('')}</div>` : ''}
    ${getApp()}
    ${related.length ? `<div class="related"><h4>Keep reading</h4><div class="grid">${related.map(card).join('')}</div></div>` : ''}
  </article></div>
  ${foot()}`;
}

const sitemap = (posts) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${esc(publicBaseUrl())}/blog</loc><changefreq>daily</changefreq><priority>0.8</priority></url>
  ${posts.map((p) => `<url><loc>${esc(publicBaseUrl())}/blog/${esc(p.slug)}</loc><lastmod>${new Date(p.updatedAt || p.publishedAt).toISOString().slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`).join('\n  ')}
</urlset>`;

const feed = (posts) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Wanna Try Journal</title><link>${esc(publicBaseUrl())}/blog</link><description>Save reels, plan trips, never miss a bill.</description>
  ${posts.map((p) => `<item><title>${esc(p.title)}</title><link>${esc(publicBaseUrl())}/blog/${esc(p.slug)}</link><guid>${esc(publicBaseUrl())}/blog/${esc(p.slug)}</guid><pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate><description>${esc(p.excerpt)}</description></item>`).join('\n  ')}
</channel></rss>`;

// ── Web admin (desktop): login, then a two-pane writer.
const ADMIN_CSS = `
  .admin { max-width:1180px; margin:0 auto; padding:0 28px 40px; display:grid; grid-template-columns:300px 1fr; gap:26px; align-items:start; }
  .side { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px; position:sticky; top:18px; max-height:calc(100vh - 40px); overflow:auto; }
  .side a.new { display:block; text-align:center; padding:11px; border-radius:11px; background:var(--teal); color:#fff; font-weight:600; text-decoration:none; margin-bottom:12px; }
  .side .item { display:block; padding:10px 8px; border-bottom:1px solid var(--line); text-decoration:none; color:inherit; }
  .side .item.on { background:var(--teal-soft); border-radius:8px; }
  .side .item b { display:block; font-weight:500; font-size:14.5px; line-height:1.3; }
  .side .item span { font-size:12px; color:var(--faint); }
  .side .pill { font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; padding:2px 7px; border-radius:999px; background:var(--line); color:var(--mute); margin-right:6px; }
  .side .pill.pub { background:#DCEFE7; color:#1B6A57; }
  .editor { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:26px; }
  .editor h1 { font-family:'DM Serif Display',Georgia,serif; font-weight:400; font-size:28px; margin:0 0 18px; }
  .f { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
  .f label { font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--faint); font-weight:600; }
  .f input, .f textarea, .f select { font:inherit; padding:11px 12px; border:1px solid var(--line); border-radius:10px; background:var(--bg); color:var(--ink); }
  .f input:focus, .f textarea:focus { outline:none; border-color:var(--teal); }
  .f textarea.body { min-height:520px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:14px; line-height:1.55; }
  .two { display:grid; grid-template-columns:1fr 1fr; gap:14px; } .three { display:grid; grid-template-columns:2fr 1fr 1fr; gap:14px; }
  .bar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:8px; }
  .btn { font:inherit; font-weight:600; padding:11px 16px; border-radius:11px; border:1px solid var(--line); background:var(--card); color:var(--ink); cursor:pointer; text-decoration:none; }
  .btn.p { background:var(--teal); border-color:var(--teal); color:#fff; } .btn.d { color:#A6392F; margin-left:auto; }
  .hint { font-size:12.5px; color:var(--faint); }
  .flash { padding:10px 14px; border-radius:10px; background:var(--teal-soft); color:var(--teal-d); margin-bottom:14px; font-size:14px; }
  .flash.err { background:#F6E3DF; color:#A6392F; }
  .pw { position:relative; } .pw input { width:100%; padding-right:44px; } .pw button { position:absolute; right:6px; top:50%; transform:translateY(-50%); width:34px; height:34px; border:0; background:none; cursor:pointer; color:var(--faint); font-size:12px; font-weight:600; letter-spacing:.04em; }
  .login { max-width:420px; margin:80px auto; background:var(--card); border:1px solid var(--line); border-radius:16px; padding:30px; }
  .login h1 { font-family:'DM Serif Display',Georgia,serif; font-weight:400; font-size:28px; margin:0 0 4px; }
  .login p { color:var(--mute); margin:0 0 20px; font-size:14.5px; }
  @media (max-width:860px) { .admin { grid-template-columns:1fr; } .side { position:static; max-height:none; } .two, .three { grid-template-columns:1fr; } }
`;
const adminHead = (title) => head({ title: `${title} — Wanna Try admin`, description: 'Wanna Try blog admin', url: `${publicBaseUrl()}/blog/admin`, extra: `<meta name="robots" content="noindex,nofollow" /><style>${ADMIN_CSS}</style>` });

function renderLogin(error) {
  return `${adminHead('Sign in')}
  <div class="nav"><a class="brand" href="${esc(publicBaseUrl())}/blog">Wanna Try <small>Admin</small></a></div>
  <form class="login" method="post" action="${esc(publicBaseUrl())}/blog/admin/login">
    <h1>Blog admin</h1><p>One account writes here. The first sign-in sets its password.</p>
    ${error ? `<div class="flash err">${esc(error)}</div>` : ''}
    <div class="f"><label>Email</label><input name="email" type="email" autocomplete="username" required /></div>
    <div class="f"><label>Password</label><span class="pw"><input name="password" type="password" autocomplete="current-password" required /><button type="button" data-eye aria-label="Show password">SHOW</button></span></div>
    <button class="btn p" type="submit" style="width:100%">Sign in</button>
  </form><script>document.querySelectorAll('[data-eye]').forEach(function(b){b.addEventListener('click',function(){var i=b.previousElementSibling;var show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'HIDE':'SHOW';});});</script>${foot()}`;
}

function renderAdmin({ posts, post, flash, error }) {
  const p = post || { title: '', slug: '', excerpt: '', keywords: [], coverEmoji: '🔖', status: 'draft', body: '' };
  const base = esc(publicBaseUrl());
  const isNew = !post;
  return `${adminHead(isNew ? 'New post' : p.title)}
  <div class="nav"><a class="brand" href="${base}/blog">Wanna Try <small>Admin</small></a><span style="display:flex;gap:14px;align-items:center;font-size:14px"><a href="${base}/blog" target="_blank">View blog ↗</a><form method="post" action="${base}/blog/admin/logout" style="margin:0"><button class="btn" type="submit">Sign out</button></form></span></div>
  <div class="admin">
    <aside class="side">
      <a class="new" href="${base}/blog/admin">+ New post</a>
      ${posts.map((x) => `<a class="item${post && String(x._id) === String(post._id) ? ' on' : ''}" href="${base}/blog/admin/${esc(x.slug)}"><span class="pill${x.status === 'published' ? ' pub' : ''}">${x.status}</span><span>${esc(day(x.publishedAt || x.updatedAt))}</span><b>${esc(x.title)}</b></a>`).join('') || '<p class="hint">No posts yet — write the first one.</p>'}
      <details style="margin-top:16px"><summary class="hint" style="cursor:pointer">Change password</summary>
        <form method="post" action="${base}/blog/admin/password" style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
          <span class="pw"><input name="current" type="password" placeholder="Current password" autocomplete="current-password" required style="font:inherit;padding:9px 10px;border:1px solid var(--line);border-radius:9px" /><button type="button" data-eye aria-label="Show password">SHOW</button></span>
          <span class="pw"><input name="next" type="password" placeholder="New password (8+)" autocomplete="new-password" minlength="8" required style="font:inherit;padding:9px 10px;border:1px solid var(--line);border-radius:9px" /><button type="button" data-eye aria-label="Show password">SHOW</button></span>
          <button class="btn" type="submit">Update</button>
        </form></details>
    </aside>
    <form class="editor" method="post" action="${base}/blog/admin/save">
      <h1>${isNew ? 'New post' : 'Edit post'}</h1>
      ${flash ? `<div class="flash">${esc(flash)}</div>` : ''}${error ? `<div class="flash err">${esc(error)}</div>` : ''}
      <input type="hidden" name="id" value="${isNew ? '' : esc(p._id)}" />
      <div class="f"><label>Title</label><input name="title" id="title" value="${esc(p.title)}" required placeholder="Save the reel. Try the place." /></div>
      <div class="three">
        <div class="f"><label>Slug (URL)</label><input name="slug" id="slug" value="${esc(p.slug)}" placeholder="auto from title" /></div>
        <div class="f"><label>Cover emoji</label><input name="coverEmoji" value="${esc(p.coverEmoji)}" maxlength="4" /></div>
        <div class="f"><label>Status</label><select name="status"><option value="draft"${p.status === 'draft' ? ' selected' : ''}>Draft</option><option value="published"${p.status === 'published' ? ' selected' : ''}>Published</option></select></div>
      </div>
      <div class="f"><label>Excerpt (meta description, ~150 chars)</label><input name="excerpt" value="${esc(p.excerpt)}" maxlength="220" /></div>
      <div class="f"><label>Keywords (comma separated — first one shows as the eyebrow)</label><input name="keywords" value="${esc((p.keywords || []).join(', '))}" placeholder="save instagram reels, bill reminder app, weekend plan delhi" /></div>
      <div class="f"><label>Body — Markdown</label><textarea class="body" name="body" placeholder="## Heading&#10;&#10;Paragraph. **Bold**, _italic_, [link](https://…)&#10;&#10;- bullet">${esc(p.body)}</textarea><span class="hint">Headings with ##, lists with -, links [text](url). Tip: one clear H2 per section, keyword in the first 100 words, a question the reader typed.</span></div>
      <div class="bar">
        <button class="btn p" type="submit" name="action" value="save">Save</button>
        <button class="btn" type="submit" name="action" value="publish">Save &amp; publish</button>
        ${!isNew ? `<a class="btn" href="${base}/blog/${esc(p.slug)}${p.status !== 'published' ? '?preview=1' : ''}" target="_blank">Preview ↗</a>` : ''}
        ${!isNew ? `<button class="btn d" type="submit" name="action" value="delete" onclick="return confirm('Delete this post for good?')">Delete</button>` : ''}
      </div>
    </form>
  </div>
  <script>
    (function(){ var t=document.getElementById('title'), s=document.getElementById('slug'); if(!t||!s) return; var touched=!!s.value;
      s.addEventListener('input',function(){touched=!!s.value});
      t.addEventListener('input',function(){ if(touched) return; s.value=t.value.toLowerCase().normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80); }); })();
  </script><script>document.querySelectorAll('[data-eye]').forEach(function(b){b.addEventListener('click',function(){var i=b.previousElementSibling;var show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'HIDE':'SHOW';});});</script>${foot()}`;
}

module.exports = { renderIndex, renderPost, renderLogin, renderAdmin, sitemap, feed, slugify, render, readingMinutes };
