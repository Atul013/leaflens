import io
import base64

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app import create_app


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path)) as session:
        yield session


def photo():
    buffer = io.BytesIO()
    Image.new('RGB', (64, 64), (40, 120, 60)).save(buffer, format='PNG')
    return buffer.getvalue()


def test_missing_model_is_explicit(client):
    assert client.get('/api/health').json()['model_ready'] is False
    response = client.post('/api/predict', files={'file': ('leaf.png', photo(), 'image/png')})
    assert response.status_code == 503
    assert 'train' in response.json()['detail'].lower()


def test_invalid_image_is_rejected_before_inference(client):
    response = client.post('/api/predict', files={'file': ('fake.jpg', b'not an image', 'image/jpeg')})
    assert response.status_code == 422


def test_oversized_upload_rejected(client):
    response = client.post('/api/predict', files={'file': ('huge.png', b'x'*(10*1024*1024+1), 'image/png')})
    assert response.status_code == 413


def test_metrics_never_fabricated(client):
    assert client.get('/api/metrics').json()['experiments'] == []


def test_unknown_model_choice_rejected(client):
    response = client.post('/api/predict', data={'architecture': 'made-up'}, files={'file': ('leaf.png', photo(), 'image/png')})
    assert response.status_code == 422


def test_incomplete_retraining_does_not_show_old_metrics(tmp_path):
    import json
    folder = tmp_path / 'cnn'
    folder.mkdir()
    (folder / 'metrics.json').write_text(json.dumps({'architecture': 'cnn', 'accuracy': .99}))
    (folder / 'run-status.json').write_text(json.dumps({'state': 'failed'}))
    with TestClient(create_app(tmp_path)) as client:
        assert client.get('/api/metrics').json()['experiments'] == []
        assert client.get('/api/health').json()['failed_runs'] == ['cnn']


def test_library_search_has_crop_and_observation_guidance(client):
    data = client.get('/api/library').json()
    assert len(data['classes']) >= 15
    disease = next(r for r in data['classes'] if r['id'] == 'Tomato___Early_blight')
    assert disease['crop'] == 'Tomato'
    assert disease['symptoms']


def test_real_checkpoint_prediction_and_heatmap(tmp_path):
    import torch
    from ml.models import create_model
    torch.manual_seed(7)
    model = create_model('cnn', 2)
    folder = tmp_path / 'cnn'
    folder.mkdir()
    torch.save({'architecture': 'cnn', 'classes': ['Tomato___healthy', 'Tomato___Early_blight'],
                'image_size': 64, 'state_dict': model.state_dict(), 'epoch': 0, 'manifest_hash': 'fixture'}, folder / 'best.pt')
    with TestClient(create_app(tmp_path)) as client:
        assert client.get('/api/health').json()['model_ready'] is True
        buffer = io.BytesIO()
        Image.new('RGB', (96, 48), (40, 120, 60)).save(buffer, format='PNG')
        result = client.post('/api/predict', files={'file': ('leaf.png', buffer.getvalue(), 'image/png')})
        assert result.status_code == 200
        body = result.json()
        assert len(body['predictions']) == 2
        assert sum(r['probability'] for r in body['predictions']) == pytest.approx(1.)
        assert body['heatmap'].startswith('data:image/png;base64,')
        overlay = Image.open(io.BytesIO(base64.b64decode(body['heatmap'].split(',')[1])))
        assert overlay.size == (96, 48)
        assert body['architecture'] == 'cnn'
        missing = client.post('/api/predict', data={'architecture': 'vgg16'}, files={'file': ('leaf.png', photo(), 'image/png')})
        assert missing.status_code == 503
        # Random checkpoint exercises plumbing only; never treated as trained quality.
