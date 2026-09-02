"""Build a print sheet from the .dc.html artboards and render it to PDF via headless Chrome.
Each artboard becomes one 390x844 page. Interactive artboards (sc-for templates) get
static equivalents so the PDF shows the resting state."""
import re, os, subprocess, sys, json
SRC = sys.argv[1]; OUT_HTML = sys.argv[2]; OUT_PDF = sys.argv[3]
ORDER = json.load(open(os.path.join(SRC,'canvas.json')))['artboards']

def part(s, a, b):
    i = s.index(a)+len(a); j = s.index(b, i); return s[i:j]

STATIC = {
 'Interests.dc.html': lambda body: re.sub(r'<sc-for[\s\S]*?</sc-for>', ''.join(
    f'<button style="display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:23px;font-family:\'Work Sans\',sans-serif;'
    + ('background:#0E7C7B;border:1.5px solid #0E7C7B;color:#fff;' if sel else 'background:#fff;border:1px solid #E7E2DA;color:#15201E;')
    + f'"><span style="width:8px;height:8px;border-radius:4px;flex-shrink:0;background:{"rgba(255,255,255,.85)" if sel else hue};"></span>'
    + f'<span style="font-size:15px;font-weight:{600 if sel else 500};">{label}</span></button>'
    for label,hue,sel in [('Cafes','#0E7C7B',1),('Street food','#C99425',1),('Restaurants','#C99425',0),('Weekend trips','#0E7C7B',1),('Recipes','#C99425',1),('Shopping','#8B5E3C',0),('Fashion','#8B5E3C',0),('Films &amp; shows','#6B5B95',0),('Books','#6B5B95',0),('Experiences','#0E7C7B',0),('Fitness','#0E7C7B',0),('Gadgets','#8B5E3C',0)]
  ), body).replace('{{countLabel}}','4 selected'),
 'MultiExtract.dc.html': lambda body: re.sub(r'<sc-for[\s\S]*?</sc-for>', ''.join(
    f'<div style="display:flex;align-items:center;gap:13px;padding:11px 12px;border-radius:14px;background:#fff;'
    + ('border:1.5px solid #0E7C7B;' if on else 'border:1px solid #E7E2DA;opacity:.6;') + '">'
    + f'<div style="width:44px;height:44px;border-radius:11px;flex-shrink:0;background:{bg};display:flex;align-items:center;justify-content:center;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="{fg}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2"/><path d="M7 4v2M10 4v2M13 4v2"/></svg></div>'
    + f'<div style="display:flex;flex-direction:column;gap:2px;flex-grow:1;min-width:0;"><span style="font-family:\'DM Serif Display\',Georgia,serif;font-size:17px;line-height:1.2;">{n}</span><span style="font-size:12.5px;color:#6E7B78;">{m}</span></div>'
    + '<div style="width:24px;height:24px;border-radius:7px;flex-shrink:0;display:flex;align-items:center;justify-content:center;' + ('background:#0E7C7B;">' + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 8"/></svg>' if on else 'border:1.5px solid #C9CFCC;">') + '</div></div>'
    for n,m,bg,fg,on in [('Blue Tokai','Hauz Khas Village · ₹400 for two','#E4EFEE','#0E7C7B',1),('Kunzum','Hauz Khas · bookshop cafe','#ECE8F3','#6B5B95',1),('Elma’s Bakery','Hauz Khas · cakes, brunch','#F6EDD6','#C99425',1),('Coast Cafe','Hauz Khas · rooftop, ₹900','#F1E7DF','#8B5E3C',0),('Naivedyam','Hauz Khas · South Indian','#E4EFEE','#0E7C7B',1)]
  ), body).replace('{{cta}}','Save 4 places'),
 'Tried.dc.html': lambda body: re.sub(r'<sc-for[\s\S]*?</sc-for>', ''.join(
    f'<div style="width:46px;height:46px;display:flex;align-items:center;justify-content:center;"><svg width="34" height="34" viewBox="0 0 24 24" fill="{"#E9D9BE" if i<=4 else "none"}" stroke="{"#E9D9BE" if i<=4 else "rgba(255,255,255,.45)"}" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z"/></svg></div>'
    for i in range(1,6)), body).replace('{{label}}','Really good'),
}

pages=[]; helmets=set()
for ab in ORDER:
    f=ab['file']; s=open(os.path.join(SRC,f),encoding='utf-8').read()
    helmet=part(s,'<helmet>','</helmet>')
    body=part(s,'</helmet>','</x-dc>')
    if f in STATIC: body=STATIC[f](body)
    # scope helmet styles: body{} rules would collide across pages; rewrite to the page wrapper
    css=part(helmet,'<style>','</style>')
    css=re.sub(r'\bbody\{', f'.p-{ab["file"][:-8]}{{', css)
    css=re.sub(r':root\{', f'.p-{ab["file"][:-8]}{{', css)
    helmets.add(css)
    pages.append((ab.get('title',f), f[:-8], body))

fonts='<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Work+Sans:wght@400;500;600;700&display=swap">'
html=['<!doctype html><html><head><meta charset="utf-8">',fonts,
 '<style>@page{size:390px 844px;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#fff}',
 '.pg{width:390px;height:844px;overflow:hidden;page-break-after:always;position:relative}',
 ' '.join(helmets),'</style></head><body>']
for title,stem,body in pages:
    html.append(f'<div class="pg p-{stem}">{body}</div>')
html.append('</body></html>')
open(OUT_HTML,'w',encoding='utf-8').write('\n'.join(html))
r=subprocess.run(['google-chrome','--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars',
  '--virtual-time-budget=8000',f'--print-to-pdf={OUT_PDF}','--no-pdf-header-footer',OUT_HTML],capture_output=True,text=True,timeout=120)
print(r.stderr.strip().splitlines()[-1] if r.stderr.strip() else 'rendered')
print('pages:',len(pages),'pdf bytes:',os.path.getsize(OUT_PDF))
