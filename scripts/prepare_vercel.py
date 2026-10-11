"""Create a curated Vercel deployment with CPU inference and bundled checkpoints.

No datasets, training environments, credentials or private vault notes are copied.
Run after building frontend; deploy the resulting .vercel-deploy directory.
"""
import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '.vercel-deploy')
    args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to(ROOT):
        raise ValueError('Deployment output must stay within the LeafLens repository.')
    if not (ROOT / 'frontend/dist/index.html').exists():
        raise RuntimeError('Build the frontend before preparing deployment.')
    for architecture in ['cnn', 'vgg16']:
        if not (ROOT / 'artifacts' / architecture / 'best.pt').exists():
            raise RuntimeError(f'Missing trained {architecture} checkpoint. Fetch the model release first.')
    output.mkdir(parents=True, exist_ok=True)
    for folder, files in {
        'backend': ['__init__.py', 'app.py', 'inference.py', 'library.py'],
        'ml': ['__init__.py', 'data.py', 'models.py', 'gradcam.py'],
    }.items():
        (output / folder).mkdir(exist_ok=True)
        for filename in files:
            shutil.copy2(ROOT / folder / filename, output / folder / filename)
    for folder in ['frontend/dist', 'frontend/public/samples']:
        shutil.copytree(ROOT / folder, output / folder, dirs_exist_ok=True)
    (output / 'docs/results').mkdir(parents=True, exist_ok=True)
    for architecture in ['cnn', 'vgg16']:
        shutil.copy2(ROOT / 'docs/results' / f'{architecture}.json', output / 'docs/results' / f'{architecture}.json')
        target = output / 'artifacts' / architecture
        target.mkdir(parents=True, exist_ok=True)
        for filename in ['best.pt', 'metrics.json']:
            shutil.copy2(ROOT / 'artifacts' / architecture / filename, target / filename)
    shutil.copy2(ROOT / 'requirements-deploy.txt', output / 'requirements.txt')
    (output / 'app.py').write_text('from backend.app import app\n', encoding='utf-8')
    (output / '.python-version').write_text('3.12\n', encoding='utf-8')
    (output / '.vercelignore').write_text('.vercel\n.env*\n.git*\n__pycache__\n*.pyc\n', encoding='utf-8')
    config = {'$schema': 'https://openapi.vercel.sh/vercel.json', 'framework': 'fastapi',
              'functions': {'app.py': {'maxDuration': 120, 'includeFiles': '{artifacts/**,docs/results/**,frontend/**}'}},
              'env': {'LEAFLENS_MAX_UPLOAD_MB': '4'}}
    (output / 'vercel.json').write_text(json.dumps(config, indent=2), encoding='utf-8')
    size = sum(path.stat().st_size for path in output.rglob('*') if path.is_file() and '.vercel' not in path.parts)
    print(f'Prepared {output}: {size/1024/1024:.1f} MB source/model assets. CPU dependencies install on Vercel.')


if __name__ == '__main__':
    main()
