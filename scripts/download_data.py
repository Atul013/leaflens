"""Download the specified Kaggle dataset into the project, never into Git."""
import argparse
import json
import shutil
from pathlib import Path

EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}


def canonical_label(label):
    aliases = {
        'Tomato__Tomato_YellowLeaf__Curl_Virus': 'Tomato___Tomato_Yellow_Leaf_Curl_Virus',
        'Tomato_Spider_mites_Two_spotted_spider_mite': 'Tomato___Spider_mites Two-spotted_spider_mite',
    }
    if label in aliases:
        return aliases[label]
    if label.startswith('Tomato') and '___' not in label:
        return 'Tomato___' + label[len('Tomato'):].strip('_')
    return label.replace('Pepper,_bell', 'Pepper__bell')


def image_class(folder):
    return folder.is_dir() and folder.name.startswith(('Tomato', 'Potato', 'Pepper')) and any(p.suffix.lower() in EXTENSIONS for p in folder.iterdir())


def find_class_root(source):
    source = Path(source)
    candidates = [p for p in [source, *(p for p in source.rglob('*') if p.is_dir())]
                  if sum(image_class(c) for c in p.iterdir()) >= 2]
    if not candidates:
        raise RuntimeError(f'Could not identify image class directory under {source}.')
    return max(candidates, key=lambda p: (sum(image_class(c) for c in p.iterdir()), p.name.lower() == 'color'))


def main():
    import kagglehub
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=Path('data/PlantVillage'))
    args = parser.parse_args()
    source = Path(kagglehub.dataset_download('emmarex/plantdisease', output_dir=str(Path('data/download').resolve())))
    chosen = find_class_root(source)
    args.output.mkdir(parents=True, exist_ok=True)
    for folder in chosen.iterdir():
        if image_class(folder):
            shutil.copytree(folder, args.output / canonical_label(folder.name), dirs_exist_ok=True)
    (args.output / 'provenance.json').write_text(json.dumps({'subset': False, 'route': 'Kaggle emmarex/plantdisease',
        'dataset': 'emmarex/plantdisease', 'source': str(chosen)}, indent=2))
    Path('data/source.json').write_text(json.dumps({'dataset': 'emmarex/plantdisease', 'url': 'https://www.kaggle.com/datasets/emmarex/plantdisease', 'source': str(chosen)}, indent=2))
    print(f'Dataset ready: {args.output.resolve()}', flush=True)


if __name__ == '__main__':
    main()
