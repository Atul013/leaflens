# LeafLens design

Build a substantial Deep Learning course project identifying crop leaf diseases using PlantVillage (Kaggle), CNN and VGG16 transfer learning. User prioritizes UI and delegates technology and feature choices while studying for exams. All work stays inside leaflens, a separate repository.

Builder choices: Python/PyTorch + FastAPI; React/Vite with lucide icons; green botanical field-station identity. Responsive diagnostic workspace, photo upload/drop/camera input, real probability ranking, Grad-CAM overlay, local diagnosis history and downloadable result. Model lab displays only measured evaluation metrics. Disease library provides general observation guidance without prescribing chemicals. No invented accuracy or fake inference: unavailable models return a clear state; optional walkthrough explicitly labeled illustrative.

ML: deterministic duplicate-aware stratified train/validation/test splits, ImageNet VGG16 feature extractor with compact head, custom CNN baseline, augmentation only on training, staged frozen/fine-tuned optimization, early stopping, imbalance weights, metrics and confusion matrix, reproducibility metadata. GPU batch size appropriate for 4 GB RTX 3050; full training can also run on Colab. Dataset and model binaries excluded from Git.

Deliver source, runnable UI/API, meaningful integration tests, training commands/notebook, course methodology and viva notes, Docker/CI, local commit with existing Git identity and remote push if authentication permits. Dataset acquisition and actual training attempted; report exact limitations and never substitute fixture metrics for real measurements.
