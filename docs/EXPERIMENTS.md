# Measured experiment record

| Model | Test accuracy | Macro F1 | Test images | Best epoch/stage |
|---|---:|---:|---:|---|
| cnn | 77.78% | 76.56% | 225 | 9 / baseline |
| vgg16 | 70.22% | 70.17% | 225 | 10 / fine_tune |

Acquisition: **upstream GitHub subset**. Assigned source: Kaggle emmarex/plantdisease. The full Kaggle archive download was attempted and stopped because throughput was about 40–50 KB/s; the measured demonstration uses authentic upstream images instead.

Classes: 15. Images per class cap: 100. Resolution: 128×128. Seed: 42. Splits: `{'train': 1050, 'val': 225, 'test': 225}`. Exact duplicate removals: 0.

Both architectures use manifest fingerprint `38659251bb021ea52590708c96241073dd7cfe271196b621239ad5d6956bfcac`. Test partition is held out from checkpoint selection. Detailed metrics and curves are in `docs/results/`. These are subset results, not a full-data benchmark or field validation.

- Controlled-background dataset; field generalization is unverified.
- Exact duplicates removed; near duplicates and physical-leaf grouping are not verified.
- Softmax confidence is not calibrated.
- No external validation dataset.
