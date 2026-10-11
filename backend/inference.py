import base64
import io
import threading
import time
from datetime import datetime, timezone

import numpy as np
from PIL import Image

from backend.library import class_info


def encode_heatmap(heat, image_size):
    """Bound responses while preserving photo aspect ratio for overlay alignment."""
    rgba = np.zeros((*heat.shape, 4), dtype=np.uint8)
    rgba[:, :, 0] = 255
    rgba[:, :, 1] = (180*(1-heat)).astype(np.uint8)
    rgba[:, :, 2] = 30
    rgba[:, :, 3] = (heat*190).astype(np.uint8)
    scale = min(1., 768 / max(image_size))
    size = tuple(max(1, round(edge*scale)) for edge in image_size)
    buffer = io.BytesIO()
    Image.fromarray(rgba).resize(size, Image.Resampling.BILINEAR).save(buffer, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()


class Predictor:
    def __init__(self, artifacts):
        self.artifacts = artifacts
        self.model = None
        self.checkpoint = None
        self.signature = None
        self.lock = threading.Lock()
        self.device = 'cpu'  # Keeps the GPU available for training; inference is single-image.

    def checkpoint_path(self, architecture=None):
        for architecture in [architecture] if architecture else ['vgg16', 'cnn']:
            candidate = self.artifacts / architecture / 'best.pt'
            if candidate.exists():
                return candidate
        return None

    def ready(self, architecture=None):
        return self.checkpoint_path(architecture) is not None

    def predict(self, image, architecture=None):
        import torch
        from ml.data import transforms
        from ml.gradcam import gradcam
        from ml.models import load_checkpoint
        started = time.perf_counter()
        with self.lock:
            path = self.checkpoint_path(architecture)
            if path is None:
                raise FileNotFoundError('Train a model before analyzing a leaf.')
            signature = (str(path), path.stat().st_mtime_ns)
            if signature != self.signature:
                torch.set_num_threads(4)
                self.model, self.checkpoint = load_checkpoint(path, self.device)
                self.model.requires_grad_(False)
                self.signature = signature
            tensor = transforms(size=self.checkpoint['image_size'])(image).unsqueeze(0)
            with torch.inference_mode():
                probabilities = self.model(tensor).softmax(1)[0]
            top = int(probabilities.argmax())
            heat = gradcam(self.model, tensor, top)
            # Transparent orange attention map, blended by the UI over the original image.
            encoded_heatmap = encode_heatmap(heat, image.size)
            ranked = sorted(enumerate(probabilities.tolist()), key=lambda row: row[1], reverse=True)
            predictions = [{**class_info(self.checkpoint['classes'][i]), 'probability': probability} for i, probability in ranked[:5]]
            confidence = float(probabilities[top])
            return {'predictions': predictions, 'heatmap': encoded_heatmap,
                    'architecture': self.checkpoint['architecture'], 'confidence': confidence,
                    'uncertain': confidence < .7, 'threshold': .7,
                    'elapsed_ms': round((time.perf_counter()-started)*1000), 'created_at': datetime.now(timezone.utc).isoformat(),
                    'model_epoch': self.checkpoint.get('epoch'), 'manifest_hash': self.checkpoint.get('manifest_hash'),
                    'notice': 'Research prediction, not a confirmed diagnosis. Confidence is an uncalibrated model score. Field performance is unverified.'}
