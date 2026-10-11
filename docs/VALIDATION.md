# Validation receipt — 11 October 2026

## Verified locally

- Python suite: **18 passed**. Covers decoded-image split isolation, deterministic class coverage, empty/small/conflicting datasets, legacy Kaggle labels, source-selection consistency, upload bounds, absent/selected models, checkpoint inference, non-square heatmap alignment, evaluation arithmetic, calibration arithmetic and frozen-backbone Grad-CAM.
- Browser suite: **7 passed**. Desktop/mobile navigation, atlas search, dialog keyboard handling, invalid uploads, recoverable service errors, compact persistent history, malformed/blocked storage, real CNN/VGG16 switching, attention overlays and all 12 presentation slides without footer overlap.
- Production frontend build: passed with Vite 6.4.4.
- Dependency consistency: `pip check` passed. `npm install` audit reported zero vulnerabilities at installation time.
- Training: CNN and VGG16 ran for 12 epochs on the NVIDIA GeForce RTX 3050 Laptop GPU with CUDA-enabled PyTorch 2.11.0. VGG16 used four frozen-head epochs and eight final-block fine-tuning epochs.
- Real VGG16 HTTP inference: 200 response for the first held-out early-blight specimen, correct top class, Grad-CAM generated. Confidence was about 41.8%, correctly marked for review; this is not a high-certainty claim.
- Notebook ordinary Python cells compile. The notebook is an unexecuted walkthrough; actual completed runs are evidenced by checkpoints, JSON records and plots.
- Screenshots visually inspected for desktop, mobile, a real attention overlay and presentation results. Screenshots are in `docs/screenshots/`.

## Scope and limits

The completed runs use an authentic upstream 15-class subset, not the complete Kaggle archive. Detailed metrics, selected source files, original dataset commit, portable split manifests and the tested Windows dependency snapshot are in `docs/results/`.

Source-only CI intentionally skips the optional real-trained-model browser test because checkpoints are separate release assets. Its API test uses a random checkpoint strictly to exercise inference plumbing. This must not be interpreted as trained model quality.

Docker configuration is supplied. Container execution is not claimed as verified. Full dataset training, physical-leaf group independence, external field performance, calibrated confidence and real farmer outcomes remain unverified.
