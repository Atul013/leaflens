import json

import pytest

from scripts.download_subset import validate_existing_selection


def test_changed_subset_selection_cannot_silently_reuse_old_images(tmp_path):
    folder = tmp_path / 'Tomato___healthy'
    folder.mkdir()
    (folder / 'old.jpg').write_bytes(b'old')
    with pytest.raises(ValueError, match='selection'):
        validate_existing_selection(tmp_path, ['raw/color/Tomato___healthy/new.jpg'], 'abc')


def test_identical_selection_and_commit_can_resume(tmp_path):
    folder = tmp_path / 'Tomato___healthy'
    folder.mkdir()
    (folder / 'same.jpg').write_bytes(b'partial-download')
    (tmp_path / 'provenance.json').write_text(json.dumps({'commit': 'abc'}))
    validate_existing_selection(tmp_path, ['raw/color/Tomato___healthy/same.jpg'], 'abc')
    with pytest.raises(ValueError, match='commit'):
        validate_existing_selection(tmp_path, ['raw/color/Tomato___healthy/same.jpg'], 'different')
