# Sources and assets

- Assigned dataset: [emmarex/plantdisease, Kaggle](https://www.kaggle.com/datasets/emmarex/plantdisease). Respect the source dataset's applicable license and terms.
- Authentic subset alternative: [spMohanty/PlantVillage-Dataset](https://github.com/spMohanty/PlantVillage-Dataset), original authors' color images. The [authors' model card](https://github.com/spMohanty/PlantVillage-Dataset/blob/master/README_HF.md) declares CC BY-SA 3.0. Attribution: Sharada P. Mohanty, David P. Hughes and Marcel Salathé, *Using Deep Learning for Image-Based Plant Disease Detection* (2016). `data/subset-source.json` records the exact commit and every selected path. Sample photos in the UI come exclusively from the held-out test partition; unchanged images retain the source license and provenance.
- Introductory decorative photograph: [Unsplash photo-1501004318641-b39e6451bec6](https://images.unsplash.com/photo-1501004318641-b39e6451bec6), distributed under the [Unsplash license](https://unsplash.com/license). This is decorative and never used as an inference example or training image. No unverified photographer attribution is invented.
- Fonts: DM Sans and Manrope, Google Fonts, SIL Open Font License. These load remotely if online; system sans-serif fallback works offline.
- Icons: Lucide, ISC license.
- Pretrained model: Torchvision VGG16 `IMAGENET1K_V1`, official PyTorch weight URL with filename `vgg16-397923af.pth`. Not committed to Git.
- The hand-drawn SVG leaf icon is part of this project's interface.

Observations in the atlas are general educational prompts, not a diagnostic reference or treatment guide. Dataset labels come from PlantVillage. The report links the VGG16 and Grad-CAM papers and library documentation.
