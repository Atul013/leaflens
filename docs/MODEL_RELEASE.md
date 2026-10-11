# LeafLens demonstration artifacts

This release accompanies the LeafLens course project source. It contains genuine trained checkpoints and an authentic upstream PlantVillage subset for reproducing the measured local demonstration.

Team: Atul Biju ASI23CA023; Athul M B ASI23CA022; Athul Chandran ASI23CA021.

| Model | Test accuracy | Macro F1 | Held-out images |
|---|---:|---:|---:|
| CNN | 77.78% | 76.56% | 225 |
| VGG16 | 70.22% | 70.17% | 225 |

Training used 1,500 images across 15 classes, 128×128 inputs, seed 42 and a shared 1,050/225/225 split. VGG16 includes frozen-head training followed by final-block fine-tuning. These are subset experiment results; no full Kaggle benchmark or field accuracy is claimed.

## Assets

- `leaflens-models.zip`: `artifacts/cnn/` and `artifacts/vgg16/`, each containing `best.pt`, measured metrics and epoch history. Fetch with `python scripts/fetch_models.py` from the repository.
- `leaflens-plantvillage-subset.zip`: `data/PlantVillage-subset/`, original image files, exact acquisition provenance and the dataset attribution/license notice. Download through the GitHub release and extract at the project root to reproduce the documented subset.
- `checksums.txt`: SHA-256 checksums of both archives.

The assigned source was PlantVillage on Kaggle. Its complete 658 MB archive download was attempted but bandwidth-limited. The completed experiment instead uses original authors' color images, with source commit and file paths recorded in the release and `docs/results/dataset-provenance.json`.

Dataset attribution: Sharada P. Mohanty, David P. Hughes and Marcel Salathé, *Using Deep Learning for Image-Based Plant Disease Detection* (2016). Original source: https://github.com/spMohanty/PlantVillage-Dataset . The authors' model card declares CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/ . Image pixels are unchanged; the bell-pepper directory name is normalized for class naming.

The model confidence scores are uncalibrated. Grad-CAM is a sensitivity visualization, not lesion segmentation. Unknown inputs can receive incorrect known-class predictions. Confirm crop observations with an agricultural expert.
