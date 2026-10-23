import io
import json
import os
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps, UnidentifiedImageError

from backend.inference import Predictor
from backend.library import CLASSES, class_info

ROOT = Path(__file__).resolve().parents[1]
MAX_BYTES = 10*1024*1024
Image.MAX_IMAGE_PIXELS = 20_000_000


def read_run_state(path):
    """Return a trusted training state, or invalid for unreadable status."""
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return 'invalid'
    if not isinstance(data, dict):
        return 'invalid'
    state = data.get('state')
    return state if state in {'training', 'failed', 'complete'} else 'invalid'


def create_app(artifacts=None, max_upload_mb=None):
    artifacts = Path(artifacts or os.getenv('LEAFLENS_ARTIFACTS', ROOT / 'artifacts'))
    upload_mb = max_upload_mb or int(os.getenv('LEAFLENS_MAX_UPLOAD_MB', '10'))
    max_bytes = upload_mb * 1024 * 1024
    predictor = Predictor(artifacts)
    app = FastAPI(title='LeafLens', version='1.0.0', description='Crop leaf disease research API')

    @app.get('/api/health')
    def health():
        path = predictor.checkpoint_path()
        training = []
        failed = []
        invalid = []
        for status in artifacts.glob('*/run-status.json'):
            state = read_run_state(status)
            target = {'training': training, 'failed': failed, 'invalid': invalid}.get(state)
            if target is not None:
                target.append(status.parent.name)
        return {'status': 'ok', 'model_ready': predictor.ready(), 'architecture': path.parent.name if path else None,
                'available_models': [a for a in ['vgg16', 'cnn'] if predictor.ready(a)],
                'device': predictor.device, 'max_upload_mb': upload_mb, 'training': training,
                'failed_runs': failed, 'invalid_runs': invalid}

    @app.get('/api/library')
    def library():
        return {'classes': [class_info(label) for label in CLASSES], 'dataset': 'emmarex/plantdisease',
                'notice': 'General observations only. Seek expert confirmation before treatment.'}

    @app.get('/api/metrics')
    def metrics():
        experiments = []
        for architecture in ['cnn', 'vgg16']:
            status = artifacts / architecture / 'run-status.json'
            if read_run_state(status) not in {None, 'complete'}:
                continue  # A new checkpoint must not be paired with an old evaluation.
            path = artifacts / architecture / 'metrics.json'
            if not path.exists() and artifacts.resolve() == (ROOT / 'artifacts').resolve():
                path = ROOT / 'docs/results' / f'{architecture}.json'
            if path.exists():
                experiments.append(json.loads(path.read_text()))
        return {'experiments': experiments}

    @app.post('/api/predict')
    def predict(file: UploadFile = File(...), architecture: str | None = Form(None)):
        if architecture is not None and architecture not in {'cnn', 'vgg16'}:
            raise HTTPException(422, 'Choose cnn or vgg16 as the analysis model.')
        raw = file.file.read(max_bytes+1)
        if len(raw) > max_bytes:
            raise HTTPException(413, f'Photo exceeds {upload_mb} MB. Choose a smaller image.')
        try:
            with Image.open(io.BytesIO(raw)) as source:
                if source.format not in {'JPEG', 'PNG', 'WEBP'}:
                    raise ValueError('Unsupported image format')
                if source.width*source.height > 20_000_000:
                    raise ValueError('Image exceeds 20 megapixels')
                image = ImageOps.exif_transpose(source).convert('RGB')
                image.load()
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise HTTPException(422, 'Choose a valid JPEG, PNG or WebP photo under 20 megapixels.')
        if not predictor.ready(architecture):
            raise HTTPException(503, 'No trained model is installed. Run the training pipeline, then try again.')
        try:
            return predictor.predict(image, architecture)
        except (RuntimeError, KeyError, ValueError) as exc:
            import logging
            logging.getLogger(__name__).exception('Model inference failed')
            raise HTTPException(503, 'Model could not be loaded. Check its checkpoint and retrain if necessary.') from exc

    samples = ROOT / 'frontend' / 'public' / 'samples'
    if samples.exists():
        app.mount('/samples', StaticFiles(directory=samples), name='samples')
    dist = ROOT / 'frontend' / 'dist'
    if dist.exists():
        app.mount('/', StaticFiles(directory=dist, html=True), name='frontend')
    return app


app = create_app()
