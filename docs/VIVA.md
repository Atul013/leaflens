# LeafLens demo and viva notes

Team: Atul Biju ASI23CA023; Athul M B ASI23CA022; Athul Chandran ASI23CA021.

## Five-minute demo

1. Open Diagnose. Explain the goal: organize crop leaf observations using a deep learning model.
2. Select a real held-out sample or upload a clear leaf photograph. Analyze it.
3. Explain the top class, alternatives and uncalibrated confidence. Do not describe confidence as certainty.
4. Toggle model attention. Explain Grad-CAM and its distinction from segmentation.
5. Open Model lab. Compare CNN/VGG16 metrics, inspect per-class failures and the manifest fingerprint.
6. Open Field notes and save a JSON result. Show the team details.
7. End with field-domain shift and the need for expert confirmation.

## Likely questions

**Why VGG16?** The course specifies VGGNet. Its pretrained convolutional features provide a useful comparison with features learned by the custom CNN. The compact head makes local execution practical.

**What is transfer learning?** Reuse representations learned on a large source dataset, then adapt a new head and selected layers to the target task. ImageNet labels are not the disease labels.

**Frozen training vs fine-tuning?** Frozen training updates only the classifier. Fine-tuning also updates the last convolutional block at a smaller learning rate.

**Why global average pooling?** It averages each feature map and replaces a very large flatten/fully-connected classifier with a small head, reducing parameter count and overfitting risk.

**How do you prevent leakage?** Split before augmentation, remove exact decoded-image duplicates, select checkpoints using validation only and evaluate using the untouched test partition. Near-duplicate/physical-leaf leakage remains an explicit limitation.

**Why macro F1 as well as accuracy?** Accuracy can hide weak minority classes. Macro F1 treats each class equally and combines precision and recall.

**Is the model confidence calibrated?** No. ECE audits calibration, but temperature scaling or another calibration method would require a separate validation procedure. The 70% caution threshold is a UI heuristic.

**Does Grad-CAM prove the disease location?** No. It is a class-dependent activation sensitivity visualization. Background sensitivity can expose model shortcuts, but attention itself does not prove correctness.

**Can it identify an unseen disease?** Not reliably. This is closed-set classification. Unknown diseases or non-leaf photographs may receive a confident known-class prediction.

**Why might field accuracy be lower?** Backgrounds, lighting, cameras, occlusion and disease stages differ from the training data. An external field dataset is needed before claiming generalization.

**What exactly was measured?** Consult `docs/results/` and the Model lab. State dataset acquisition route, selected class count, sample count, image resolution, split counts, seed and checkpoint stage. A subset experiment is not a full Kaggle benchmark.

**What are the next steps?** Full-data training, physical-leaf group splits, field validation, confidence calibration, robust unknown-input detection, compression and farmer usability testing.
