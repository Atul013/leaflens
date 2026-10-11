"""Fetch project-owned model release. Private repositories require gh login."""
import argparse
import subprocess
import zipfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo', default='Atul013/leaflens')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    download = root / 'data' / 'model-download'
    download.mkdir(parents=True, exist_ok=True)
    subprocess.run(['gh', 'release', 'download', 'demo-models', '-R', args.repo,
                    '--pattern', 'leaflens-models.zip', '--dir', str(download), '--clobber'], check=True)
    with zipfile.ZipFile(download / 'leaflens-models.zip') as archive:
        for member in archive.infolist():
            destination = (root / member.filename).resolve()
            if not destination.is_relative_to(root / 'artifacts'):
                raise ValueError('Release archive contains a path outside artifacts.')
        archive.extractall(root)
    print('Model artifacts installed. Start or refresh LeafLens.')


if __name__ == '__main__':
    main()
