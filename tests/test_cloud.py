import base64
import io

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from backend.app import create_app
from backend.inference import encode_heatmap


def test_cloud_upload_limit_is_advertised_and_enforced(tmp_path):
    with TestClient(create_app(tmp_path, max_upload_mb=4)) as client:
        assert client.get('/api/health').json()['max_upload_mb'] == 4
        response = client.post('/api/predict', files={'file': ('camera.jpg', b'x' * (4*1024*1024+1), 'image/jpeg')})
        assert response.status_code == 413
        assert '4 MB' in response.json()['detail']


def test_attention_response_is_bounded_for_large_camera_photos():
    heat = np.linspace(0, 1, 64*64, dtype=np.float32).reshape(64, 64)
    encoded = encode_heatmap(heat, (4000, 2000))
    decoded = base64.b64decode(encoded.split(',')[1])
    image = Image.open(io.BytesIO(decoded))
    assert image.size == (768, 384)
    assert len(encoded) < 4_000_000
