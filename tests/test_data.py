from pathlib import Path

import pytest
from PIL import Image

from ml.data import build_manifest


def make_data(root):
    for label, offset in [('Tomato___healthy', 0), ('Tomato___Early_blight', 100)]:
        folder = root / label
        folder.mkdir(parents=True)
        for i in range(12):
            Image.new('RGB', (24, 24), (offset+i, 30, 90)).save(folder / f'{i}.png')
    (root / 'Tomato___healthy' / 'duplicate.png').write_bytes((root / 'Tomato___healthy' / '0.png').read_bytes())


def test_splits_are_disjoint_and_reproducible(tmp_path):
    make_data(tmp_path)
    first = build_manifest(tmp_path, seed=42)
    assert first == build_manifest(tmp_path, seed=42)
    by_hash = {}
    for row in first['samples']:
        by_hash.setdefault(row['sha256'], set()).add(row['split'])
    assert all(len(splits) == 1 for splits in by_hash.values())
    assert len(first['samples']) == 24
    assert first['duplicates_removed'] == 1
    for split in ['train', 'val', 'test']:
        assert {r['label'] for r in first['samples'] if r['split'] == split} == set(first['classes'])


def test_empty_dataset_rejected(tmp_path):
    with pytest.raises(ValueError, match='class'):
        build_manifest(tmp_path)


def test_conflicting_duplicate_labels_rejected(tmp_path):
    make_data(tmp_path)
    (tmp_path / 'Tomato___Early_blight' / 'conflict.png').write_bytes((tmp_path / 'Tomato___healthy' / '0.png').read_bytes())
    with pytest.raises(ValueError, match='conflicting'):
        build_manifest(tmp_path)


def test_small_classes_rejected(tmp_path):
    for label in ['a', 'b']:
        (tmp_path / label).mkdir()
        Image.new('RGB', (24, 24), (1 if label == 'a' else 2, 0, 0)).save(tmp_path / label / 'one.png')
    with pytest.raises(ValueError, match='at least'):
        build_manifest(tmp_path)
