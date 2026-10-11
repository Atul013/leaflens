"""Package the exact demonstration subset with source attribution."""
import hashlib
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NOTICE = '''PlantVillage demonstration subset

Dataset authors: Sharada P. Mohanty, David P. Hughes and Marcel Salathe.
Paper: Using Deep Learning for Image-Based Plant Disease Detection (2016).
DOI: 10.3389/fpls.2016.01419
Source: https://github.com/spMohanty/PlantVillage-Dataset
License declared by the authors' model card: CC BY-SA 3.0.
https://creativecommons.org/licenses/by-sa/3.0/

Image pixels are unchanged. The bell-pepper class directory name is normalized.
This is a documented 100-images-per-class, 15-class subset, not the full Kaggle
archive. provenance.json records exact source commit and selected file paths.
'''


def main():
    source = ROOT / 'data/PlantVillage-subset'
    (source / 'DATASET-NOTICE.txt').write_text(NOTICE, encoding='utf-8')
    target = ROOT / 'artifacts/leaflens-plantvillage-subset.zip'
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source.rglob('*')):
            if path.is_file():
                archive.write(path, path.relative_to(ROOT).as_posix())
    lines = []
    for path in [ROOT / 'artifacts/leaflens-models.zip', target]:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        lines.append(f'{digest}  {path.name}')
    (ROOT / 'artifacts/checksums.txt').write_text('\n'.join(lines)+'\n', encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
