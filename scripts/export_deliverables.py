"""Build print report HTML and a structured, editable presentation source."""
from pathlib import Path
import json
import markdown
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'downloads'
OUT.mkdir(exist_ok=True)
report = (ROOT / 'docs/REPORT.md').read_text(encoding='utf-8')
report = report.replace('photos (10 MB maximum, 20 megapixels maximum)', 'photos (4 MB hosted / 10 MB local maximum, 20 megapixels maximum)')
body = markdown.markdown(report, extensions=['tables', 'fenced_code'])
cover = '''<section class="cover"><div class="eyebrow">DEEP LEARNING / COURSE PROJECT</div><h1>LeafLens</h1><h2>Explainable crop leaf<br>disease classification</h2><p class="tagline">A closer look. A healthier harvest.</p><div class="team">Atul Biju · ASI23CA023<br>Athul M B · ASI23CA022<br>Athul Chandran · ASI23CA021</div><p>CNN baseline · VGG16 transfer learning · Grad-CAM</p><a href="https://leaflens-black.vercel.app">leaflens-black.vercel.app</a><div class="date">11 October 2026</div></section>'''
css = '''@page{size:A4;margin:20mm 19mm 20mm}*{box-sizing:border-box}body{font:11pt/1.65 Arial,sans-serif;color:#243b2c;margin:0}h1,h2,h3{color:#173e2c;line-height:1.25}h1{font-size:24pt}h2{font-size:18pt;margin-top:25pt;break-after:avoid}h3{font-size:13pt;margin-top:20pt;break-after:avoid}p{margin:0 0 11pt}a{color:#386a39;text-decoration:none;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;font-size:9.5pt;margin:14pt 0;break-inside:avoid}th{background:#173e2c;color:white;text-align:left}td,th{padding:8pt;border-bottom:1px solid #d8dfcf}tr:nth-child(even){background:#f2f5ed}li{margin:5pt 0}code{font:9pt Consolas,monospace;background:#f1f4ed;overflow-wrap:anywhere}img{max-width:100%}.cover{height:246mm;break-after:page;background:#f2f6e9;padding:21mm 13mm;position:relative;border-top:9mm solid #173e2c}.cover h1{font-size:55pt;margin:25mm 0 10mm}.cover h2{font-size:25pt}.cover .eyebrow{font-size:10pt;letter-spacing:2px}.tagline{margin-top:12mm;color:#617c4a}.team{margin:20mm 0 10mm;line-height:2}.date{position:absolute;bottom:15mm;font-size:10pt}.figures{break-before:page}.figures img{max-height:105mm;object-fit:contain;display:block;margin:8mm auto}.caption{font-size:9pt;color:#61704e;text-align:center}'''
figures = '<section class="figures"><h2>Measured experiment visualizations</h2>'
for name, label in [('vgg16-training-curves.png','VGG16 training and validation curves.'),('vgg16-confusion-matrix.png','VGG16 held-out confusion matrix; 225 test images.')]:
    figures += f'<img src="{(ROOT / "docs/results" / name).as_uri()}"><p class="caption">{label}</p>'
figures += '</section><section class="figures"><h2>Deployed application</h2><p>The complete application hosts both trained models on Vercel. Original uploaded photos are not retained by the service; compact field notes remain in the user’s browser.</p>'
figures += f'<img src="{(ROOT / "docs/screenshots/real-diagnosis.png").as_uri()}"><p class="caption">Live diagnosis interface with model prediction and Grad-CAM controls.</p><p>Live application: <a href="https://leaflens-black.vercel.app">https://leaflens-black.vercel.app</a></p><p>Verification: 20 Python tests, 7 browser checks, and GitHub CI passed. These checks establish software behavior, not field classification accuracy.</p></section>'
(OUT / 'report-print.html').write_text(f'<!doctype html><html><meta charset="utf-8"><title>LeafLens Report</title><style>{css}</style><body>{cover}{body}{figures}</body></html>',encoding='utf-8')
soup = BeautifulSoup((ROOT / 'docs/PRESENTATION.html').read_text(encoding='utf-8'),'html.parser')
slides = []
for section in soup.select('.slide'):
    title = section.select_one('h1,h2').get_text(' ',strip=True)
    blocks = [e.get_text('\n' if 'team' in e.get('class',[]) else ' ',strip=True) for e in section.select('p,h3,li,.team') if not e.find_parent('ul') or e.name=='li']
    blocks = [b.replace('Local processing and an inspectable history','Hosted inference and a browser-local history') for b in blocks]
    images = [str((ROOT/'docs'/im['src']).resolve()) for im in section.select('img')]
    slides.append({'label':section.select_one('.slide-label').get_text(' ',strip=True),'title':title,'blocks':blocks,'images':images})
(OUT / 'slides-source.json').write_text(json.dumps(slides,ensure_ascii=False,indent=2),encoding='utf-8')
print(OUT)
