"""Publish only measured results, provenance, and held-out UI specimens."""
import html
import json
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    output = ROOT / 'docs/results'
    output.mkdir(parents=True, exist_ok=True)
    experiments = []
    manifests = []
    for architecture in ['cnn', 'vgg16']:
        folder = ROOT / 'artifacts' / architecture
        if not (folder / 'metrics.json').exists():
            continue
        metrics = json.loads((folder / 'metrics.json').read_text())
        experiments.append(metrics)
        shutil.copy2(folder / 'metrics.json', output / f'{architecture}.json')
        for filename in ['training-curves.png', 'confusion-matrix.png']:
            shutil.copy2(folder / filename, output / f'{architecture}-{filename}')
        manifest = json.loads((folder / 'manifest.json').read_text())
        manifests.append(manifest)
        portable = {**manifest, 'root': 'data/' + Path(manifest['root']).name}
        (output / f'{architecture}-manifest.json').write_text(json.dumps(portable, indent=2))
    if not experiments:
        raise RuntimeError('No completed experiment metrics. Train a model first.')
    if len({e['manifest_hash'] for e in experiments}) != 1:
        raise RuntimeError('Experiment split fingerprints differ; do not present them as a controlled comparison.')
    source = ROOT / 'data/subset-source.json'
    if source.exists():
        shutil.copy2(source, output / 'dataset-provenance.json')
    from backend.library import class_info
    manifest = manifests[-1]
    sample_dir = ROOT / 'frontend/public/samples'
    sample_dir.mkdir(parents=True, exist_ok=True)
    wanted = ['Tomato___Early_blight', 'Tomato___healthy', 'Potato___Late_blight', 'Pepper__bell___Bacterial_spot']
    catalog = []
    for index, label in enumerate(wanted):
        row = next(r for r in manifest['samples'] if r['split'] == 'test' and r['label'] == label)
        source = Path(manifest['root']) / row['path']
        filename = f'specimen-{index+1}{source.suffix.lower()}'
        shutil.copy2(source, sample_dir / filename)
        info = class_info(label)
        catalog.append({'url': '/samples/' + filename, 'name': info['condition'], 'crop': info['crop'],
                        'label': label, 'partition': 'test', 'source_path': row['path'], 'sha256_decoded_pixels': row['sha256']})
    (sample_dir / 'catalog.json').write_text(json.dumps(catalog, indent=2))
    rows = ['| Model | Test accuracy | Macro F1 | Test images | Best epoch/stage |', '|---|---:|---:|---:|---|']
    for e in experiments:
        rows.append(f'| {e["architecture"]} | {e["accuracy"]:.2%} | {e["macro_f1"]:.2%} | {e["test_samples"]} | {e["best_epoch"]} / {e["best_stage"]} |')
    first = experiments[0]
    (ROOT / 'docs/EXPERIMENTS.md').write_text('# Measured experiment record\n\n' + '\n'.join(rows) +
        f'\n\nAcquisition: **{first["acquisition"]}**. Assigned source: Kaggle emmarex/plantdisease. The full Kaggle archive download was attempted and stopped because throughput was about 40–50 KB/s; the measured demonstration uses authentic upstream images instead.\n\n' +
        f'Classes: {len(first["classes"])}. Images per class cap: {first["max_per_class"]}. Resolution: {first["image_size"]}×{first["image_size"]}. Seed: {first["seed"]}. Splits: `{first["split_counts"]}`. Exact duplicate removals: {first["duplicates_removed"]}.\n\n' +
        f'Both architectures use manifest fingerprint `{first["manifest_hash"]}`. Test partition is held out from checkpoint selection. Detailed metrics and curves are in `docs/results/`. These are subset results, not a full-data benchmark or field validation.\n\n' +
        '\n'.join('- ' + l for l in first['limitations']) + '\n', encoding='utf-8')
    presentation(experiments)
    archive_path = ROOT / 'artifacts/leaflens-models.zip'
    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as archive:
        for architecture in ['cnn', 'vgg16']:
            folder = ROOT / 'artifacts' / architecture
            if (folder / 'best.pt').exists():
                for filename in ['best.pt', 'metrics.json', 'history.json']:
                    archive.write(folder / filename, f'artifacts/{architecture}/{filename}')
    print(f'Published {len(experiments)} measured experiments, 4 held-out samples and model archive.', flush=True)


def presentation(experiments):
    table = ''.join(f'<tr><td>{e["architecture"].upper()}</td><td>{e["accuracy"]:.1%}</td><td>{e["macro_f1"]:.1%}</td><td>{e["test_samples"]}</td></tr>' for e in experiments)
    first = experiments[0]
    content = [
        ('LeafLens', '<div class="split"><div><h1>A closer look.<br>A healthier harvest.</h1><p>Explainable crop leaf disease classification<br>CNN · VGG16 transfer learning · PlantVillage</p><div class="team">Atul Biju · ASI23CA023<br>Athul M B · ASI23CA022<br>Athul Chandran · ASI23CA021</div></div><img class="cover" src="../frontend/public/botanical.jpg" alt="Decorative foliage"></div>'),
        ('The problem', '<h2>Low-cost observations.<br>Better crop health conversations.</h2><p>Can convolutional visual features distinguish leaf disease patterns—and make their predictions inspectable?</p><div class="three"><article><h3>Observe</h3><p>A clear leaf photograph is an inexpensive input.</p></article><article><h3>Compare</h3><p>A CNN baseline tests what can be learned from scratch.</p></article><article><h3>Explain</h3><p>VGG16, confidence alternatives and Grad-CAM reveal the model’s view.</p></article></div>'),
        ('Week 1 · Dataset preparation', f'<h2>Start with a defensible split.</h2><p>Assigned source: PlantVillage, Kaggle. Measured run: documented upstream color subset.</p><div class="three"><article><strong>{len(first["classes"])}</strong><p>Classes across tomato, potato and bell pepper</p></article><article><strong>{sum(first["split_counts"].values())}</strong><p>Unique selected images after duplicate removal</p></article><article><strong>70 / 15 / 15</strong><p>Per-class train / validation / test partition</p></article></div><p class="note">Decoded-pixel duplicates removed before splitting. Seed 42. Physical-leaf grouping and near duplicates remain unverified.</p>'),
        ('Week 1 · Preprocessing', '<h2>Learn variation.<br>Keep evaluation stable.</h2><div class="split"><article><h3>Training only</h3><ul><li>Horizontal and vertical flips</li><li>Rotation up to 20 degrees</li><li>Mild color and brightness variation</li><li>Class weights from training counts</li></ul></article><article><h3>Every image</h3><ul><li>Orientation correction and RGB conversion</li><li>Resize to configured resolution</li><li>ImageNet mean / standard deviation</li><li>Deterministic validation and test transforms</li></ul></article></div>'),
        ('Week 1 · Architecture and base training', '<h2>Two ways to learn the leaf.</h2><div class="split"><article><h3>Custom CNN</h3><p>Four Conv → BatchNorm → ReLU → Pool blocks.<br>32 → 64 → 128 → 256 channels.</p><p>Global pooling, dropout, disease logits.<br>Randomly initialized.</p></article><article><h3>VGG16 transfer learning</h3><p>ImageNet convolutional backbone.<br>Global pooling → 512 → 256 → class logits.</p><p>Freeze the backbone first.<br>Train the compact disease head.</p></article></div><p class="note">Same partition, seed and input resolution for a controlled architecture comparison.</p>'),
        ('Week 2 · Fine-tuning', '<h2>Adapt carefully.<br>Preserve useful features.</h2><div class="flow"><article><span>Frozen stage</span><h3>Classifier only</h3><p>AdamW · learning rate 1e-3</p></article><b>→</b><article><span>Fine-tuning stage</span><h3>Final VGG16 block + head</h3><p>AdamW · learning rate 1e-5</p></article></div><p>Dropout, weight decay and label smoothing regularize training. Validation selects checkpoints; test images do not.</p><p class="note">Early stopping cannot skip the required fine-tuning phase. The best checkpoint may still come from the frozen stage.</p>'),
        ('Week 2 · Measured evaluation', f'<h2>Results you can inspect.</h2><table><thead><tr><th>Model</th><th>Test accuracy</th><th>Macro F1</th><th>Test images</th></tr></thead><tbody>{table}</tbody></table><p class="note">Real subset experiment · {first["image_size"]}×{first["image_size"]} inputs · {first["max_per_class"]} images/class cap · controlled backgrounds. These results do not establish field accuracy.</p><p>Macro F1 gives each class equal weight. Per-class precision, recall and confusion matrices reveal hidden weaknesses.</p>'),
        ('Week 2 · Visualization', '<h2>Look at the mistakes, too.</h2><div class="split"><img class="chart" src="results/vgg16-training-curves.png" alt="Measured VGG16 training curves"><img class="chart" src="results/vgg16-confusion-matrix.png" alt="Held-out VGG16 confusion matrix"></div><p class="note">Training/validation curves expose overfitting. The confusion matrix shows which true classes are mistaken for other classes.</p>'),
        ('Explainability', '<h2>Where is the model looking?</h2><p>Grad-CAM weights final convolutional activations by class gradients, rectifies the combined map, and overlays it on the photograph.</p><div class="three"><article><h3>Inspect</h3><p>See regions influencing the selected class.</p></article><article><h3>Question</h3><p>Check whether backgrounds attract attention.</p></article><article><h3>Interpret carefully</h3><p>Attention is not lesion segmentation, severity or proof of correctness.</p></article></div>'),
        ('The interface', '<h2>A crop health field station.</h2><img class="ui-shot" src="screenshots/diagnose-desktop.png" alt="LeafLens diagnosis interface"><p class="note">Diagnosis · disease atlas · measured model lab · local field notes</p>'),
        ('Social relevance and boundaries', '<h2>A second pair of eyes.<br>An expert still matters.</h2><div class="split"><article><h3>Potential value</h3><ul><li>Low-cost photographic observations</li><li>Local processing and an inspectable history</li><li>Clear information for agricultural consultation</li></ul></article><article><h3>What remains unverified</h3><ul><li>Real field generalization</li><li>Unknown diseases and non-leaf inputs</li><li>Calibrated probabilities</li><li>Farmer outcomes or yield improvements</li></ul></article></div>'),
        ('Next steps and references', '<h2>From a course experiment<br>to field evidence.</h2><p>Full-data training → leaf-grouped splits → external field validation → confidence calibration → usability studies.</p><ul class="references"><li>Mohanty et al. (2016), Using Deep Learning for Image-Based Plant Disease Detection.</li><li>Simonyan & Zisserman (2014), Very Deep Convolutional Networks for Large-Scale Image Recognition.</li><li>Selvaraju et al. (2016), Grad-CAM: Visual Explanations from Deep Networks.</li><li>PlantVillage Kaggle dataset; original authors’ dataset repository; PyTorch/Torchvision documentation.</li></ul><p>Live demonstration: open LeafLens and inspect a held-out sample.</p>'),
    ]
    slides = ''.join(f'<section class="slide {"active" if i==0 else ""}" aria-hidden="{"false" if i==0 else "true"}"><div class="slide-label">{html.escape(title)}</div>{body}<div class="slide-footer"><span>LeafLens · Deep Learning course project</span><span>{i+1:02d} / {len(content)}</span></div></section>' for i,(title,body) in enumerate(content))
    document = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LeafLens — course presentation</title><style>
    :root{--forest:#173e2c;--paper:#f5f8ef;--muted:#728565;--accent:#cbe79d}*{box-sizing:border-box}body{margin:0;background:#0e261a;color:var(--forest);font-family:system-ui,sans-serif}.deck{position:absolute;inset:0;margin:auto;width:min(100vw,177.78vh);height:min(100vh,56.25vw)}.slide{position:absolute;inset:0;background:var(--paper);padding:5% 6%;display:none;overflow:hidden}.slide.active{display:block}.slide-label{color:var(--muted);font-size:clamp(11px,1.2vw,18px);margin-bottom:3%}h1,h2{font-size:clamp(27px,4.3vw,66px);letter-spacing:-.04em;line-height:1.15;font-weight:600;margin:0 0 3%}h3{font-size:clamp(14px,1.6vw,25px);font-weight:600}p,li{font-size:clamp(12px,1.45vw,22px);line-height:1.7;color:#627954}p{max-width:960px}ul{padding-left:22px}.split{display:grid;grid-template-columns:1fr 1fr;gap:5%;align-items:center}.three{display:grid;grid-template-columns:repeat(3,1fr);gap:3%;margin-top:4%}article{border-top:2px solid #a3bd80;padding:3% 0}.three strong{font-size:clamp(30px,3.5vw,55px);font-weight:500}.cover{width:100%;height:470px;max-height:60vh;object-fit:cover;border-radius:18px}.team{font-size:clamp(11px,1.2vw,18px);line-height:1.9;color:#70895e;margin-top:8%}.note{font-size:clamp(10px,1.15vw,17px);color:#7b8e6c;margin-top:3%}.slide-footer{position:absolute;left:6%;right:6%;bottom:4%;display:flex;justify-content:space-between;border-top:1px solid #d6e2c8;padding-top:12px;font-size:clamp(9px,1vw,14px);color:#7e936d}.flow{display:flex;gap:3%;align-items:center;margin:5% 0}.flow article{flex:1}.flow b{font-size:30px;color:#819e60}.flow span{font-size:12px;color:#81986e}table{width:100%;border-collapse:collapse;margin:5% 0;font-size:clamp(14px,1.6vw,24px)}th,td{padding:18px;text-align:left;border-bottom:1px solid #d9e3cc}th{color:#73865e;font-size:.7em;font-weight:500}.chart{width:100%;max-height:360px;object-fit:contain}.ui-shot{width:100%;height:56%;object-fit:contain;object-position:left}.references{margin-top:5%}.references li{font-size:clamp(11px,1.2vw,18px)}.controls{position:fixed;bottom:10px;right:15px;z-index:10;display:flex;gap:7px}button{background:#d9e9be;color:#20442b;border:0;border-radius:7px;padding:9px 15px;cursor:pointer}button:focus-visible{outline:3px solid #93b66c;outline-offset:3px}@media(max-width:700px){.deck{position:static;width:100%;height:100vh}.slide{padding:30px 24px 70px;overflow:auto}.split,.three{grid-template-columns:1fr;gap:15px}.cover{display:none}.chart{max-height:220px}h2{font-size:31px}.slide-footer{position:fixed;bottom:50px;background:var(--paper)}p,li{font-size:14px}.ui-shot{height:auto}.slide-label{margin-bottom:24px}}@media print{@page{size:landscape;margin:0}body{background:white}.deck{position:static;width:auto;height:auto}.slide{display:block!important;position:relative;width:297mm;height:167mm;break-after:page}.controls{display:none}h1,h2{font-size:42px}p,li{font-size:15px}.cover{height:100mm}.chart{max-height:80mm}.ui-shot{height:95mm}.slide-footer{font-size:10px}.slide-label{font-size:13px}}
    </style></head><body><main class="deck">''' + slides + '''</main><nav class="controls" aria-label="Slide controls"><button id="previous" aria-label="Previous slide">←</button><button id="next" aria-label="Next slide">→</button></nav><script>let index=0;const slides=[...document.querySelectorAll('.slide')];function show(next){index=Math.max(0,Math.min(slides.length-1,next));slides.forEach((slide,i)=>{slide.classList.toggle('active',i===index);slide.setAttribute('aria-hidden',i===index?'false':'true')});document.title='LeafLens · slide '+(index+1)+' of '+slides.length}document.getElementById('previous').onclick=()=>show(index-1);document.getElementById('next').onclick=()=>show(index+1);document.addEventListener('keydown',event=>{if(['ArrowRight','PageDown',' '].includes(event.key)){event.preventDefault();show(index+1)}if(['ArrowLeft','PageUp'].includes(event.key)){event.preventDefault();show(index-1)}if(event.key==='Home')show(0);if(event.key==='End')show(slides.length-1)});</script></body></html>'''
    document = document.replace('.slide{position:absolute;inset:0;background:var(--paper);padding:5% 6%', '.slide{position:absolute;inset:0;background:var(--paper);padding:4% 6%')
    document = document.replace('margin-bottom:3%', 'margin-bottom:2%').replace('margin:0 0 3%', 'margin:0 0 2%')
    document = document.replace('.flow{display:flex;gap:3%;align-items:center;margin:5% 0}', '.flow{display:flex;gap:3%;align-items:center;margin:3% 0}')
    document = document.replace('color:#7b8e6c;margin-top:3%', 'color:#7b8e6c;margin-top:2%').replace('height:56%;object-fit:contain', 'height:45%;object-fit:contain')
    (ROOT / 'docs/PRESENTATION.html').write_text(document, encoding='utf-8')


if __name__ == '__main__':
    main()
