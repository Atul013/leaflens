"""Small, authentic upstream PlantVillage subset when Kaggle bandwidth is limited.

This is explicitly a different acquisition route, not a claim of downloading
the complete Kaggle dataset. It records source commit and every selected file.
"""
import argparse
import concurrent.futures
import json
import random
import sys
from pathlib import Path

import requests

REPO = 'spMohanty/PlantVillage-Dataset'
CROPS = ('Tomato___', 'Potato___', 'Pepper,_bell___')


def validate_existing_selection(output, chosen, commit):
    output = Path(output)
    allowed = {Path(path.split('/')[2].replace('Pepper,_bell', 'Pepper__bell')) / path.split('/')[-1] for path in chosen}
    existing = {file.relative_to(output) for file in output.rglob('*') if file.is_file() and file.suffix.lower() in {'.jpg', '.jpeg', '.png'}}
    if existing - allowed:
        raise ValueError('Existing images do not match this selection. Choose a fresh output directory.')
    record = output / 'provenance.json'
    if existing and (not record.exists() or json.loads(record.read_text()).get('commit') != commit):
        raise ValueError('Existing images have a different or unverified source commit. Choose a fresh output directory.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--per-class', type=int, default=100)
    parser.add_argument('--output', type=Path, default=Path('data/PlantVillage-subset'))
    args = parser.parse_args()
    response = requests.get(f'https://api.github.com/repos/{REPO}/commits/master', timeout=60)
    response.raise_for_status()
    commit = response.json()['sha']
    # Descend to color before asking for recursion: the complete repository
    # includes grayscale/segmented variants and exceeds GitHub's tree limit.
    subtree = commit
    for folder in ['raw', 'color']:
        response = requests.get(f'https://api.github.com/repos/{REPO}/git/trees/{subtree}', timeout=60)
        response.raise_for_status()
        subtree = next(row['sha'] for row in response.json()['tree'] if row['path'] == folder)
    response = requests.get(f'https://api.github.com/repos/{REPO}/git/trees/{subtree}', timeout=60)
    response.raise_for_status()
    tree = response.json()
    grouped = {}
    for row in tree['tree']:
        label = row['path']
        if not label.startswith(CROPS) or row['type'] != 'tree':
            continue
        response = requests.get(f'https://api.github.com/repos/{REPO}/git/trees/{row["sha"]}', timeout=60)
        response.raise_for_status()
        listing = response.json()
        if listing.get('truncated'):
            raise RuntimeError(f'Class listing truncated: {label}')
        grouped[label] = ['raw/color/' + label + '/' + item['path'] for item in listing['tree']
                          if item['path'].lower().endswith(('.jpg', '.png', '.jpeg'))]
    if len(grouped) != 15:
        raise RuntimeError(f'Expected 15 relevant upstream classes, found {len(grouped)}.')
    rng = random.Random(42)
    chosen = []
    for label, paths in sorted(grouped.items()):
        paths.sort()
        rng.shuffle(paths)
        chosen.extend(paths[:args.per_class])
    args.output.mkdir(parents=True, exist_ok=True)
    validate_existing_selection(args.output, chosen, commit)
    provenance = {'repository': REPO, 'commit': commit, 'subset': True,
        'route': 'upstream GitHub color subset; Kaggle full download was bandwidth-limited', 'seed': 42,
        'per_class': args.per_class, 'selected_files': chosen}
    # Record the selection before downloading, so interrupted jobs can resume
    # only against a known commit and compatible set of paths.
    (args.output / 'provenance.json').write_text(json.dumps(provenance, indent=2))

    def download(path):
        label = path.split('/')[2].replace('Pepper,_bell', 'Pepper__bell')
        destination = args.output / label / path.split('/')[-1]
        destination.parent.mkdir(exist_ok=True)
        if not destination.exists():
            from urllib.parse import quote
            raw = requests.get(f'https://raw.githubusercontent.com/{REPO}/{commit}/{quote(path)}', timeout=60)
            raw.raise_for_status()
            destination.write_bytes(raw.content)
        return path

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        for index, _ in enumerate(executor.map(download, chosen), 1):
            if index % 100 == 0:
                print(f'{index}/{len(chosen)} authentic images downloaded', flush=True)
    (args.output.parent / 'subset-source.json').write_text(json.dumps(provenance, indent=2))
    print(f'Ready: {len(chosen)} images, {len(grouped)} classes, {args.output}', flush=True)


if __name__ == '__main__':
    main()
