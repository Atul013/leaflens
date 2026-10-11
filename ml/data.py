import hashlib
import random
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageOps

EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}


def build_manifest(root: Path, seed: int = 42, max_per_class: int | None = None) -> dict:
    """Deduplicate decoded pixels before a seeded, per-class 70/15/15 split.

    Exact duplicates across labels are an annotation error. Near duplicates and
    multiple photographs of one physical leaf still need a separate group audit.
    """
    root = Path(root).resolve()
    folders = sorted(p for p in root.iterdir() if p.is_dir() and any(f.suffix.lower() in EXTENSIONS for f in p.iterdir()))
    if len(folders) < 2:
        raise ValueError('Dataset needs at least two image class directories.')
    samples, seen, duplicates = defaultdict(list), {}, 0
    for folder in folders:
        for file in sorted(folder.iterdir()):
            if file.suffix.lower() not in EXTENSIONS:
                continue
            with Image.open(file) as im:
                im = ImageOps.exif_transpose(im).convert('RGB')
                digest = hashlib.sha256(str(im.size).encode() + im.tobytes()).hexdigest()
            if digest in seen:
                if seen[digest] != folder.name:
                    raise ValueError(f'Image has conflicting labels: {file.name}')
                duplicates += 1
                continue
            seen[digest] = folder.name
            samples[folder.name].append({'path': file.relative_to(root).as_posix(), 'label': folder.name, 'sha256': digest})
    rng = random.Random(seed)
    records = []
    for label in sorted(samples):
        rows = samples[label]
        rng.shuffle(rows)
        if max_per_class is not None:
            if max_per_class < 7:
                raise ValueError('max_per_class must be at least 7.')
            rows = rows[:max_per_class]
        if len(rows) < 7:
            raise ValueError(f'{label} needs at least 7 unique images for three splits.')
        n_val = max(1, round(len(rows) * .15))
        n_test = max(1, round(len(rows) * .15))
        for i, row in enumerate(rows):
            row['split'] = 'val' if i < n_val else 'test' if i < n_val+n_test else 'train'
            records.append(row)
    return {'root': str(root), 'seed': seed, 'classes': sorted(samples), 'samples': records,
            'duplicates_removed': duplicates, 'max_per_class': max_per_class, 'split_policy': 'decoded-pixel-deduplicated stratified 70/15/15'}


def transforms(training=False, size=224):
    from torchvision import transforms as T
    steps = [T.Resize((size, size))]
    if training:
        steps += [T.RandomHorizontalFlip(), T.RandomVerticalFlip(), T.RandomRotation(20),
                  T.ColorJitter(brightness=.15, contrast=.15, saturation=.1)]
    return T.Compose(steps + [T.ToTensor(), T.Normalize([.485, .456, .406], [.229, .224, .225])])


class LeafDataset:
    def __init__(self, manifest, split, training=False, size=224):
        self.root = Path(manifest['root'])
        self.rows = [r for r in manifest['samples'] if r['split'] == split]
        self.classes = manifest['classes']
        self.mapping = {label: i for i, label in enumerate(self.classes)}
        self.transform = transforms(training, size)

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        with Image.open(self.root / row['path']) as im:
            image = ImageOps.exif_transpose(im).convert('RGB')
        return self.transform(image), self.mapping[row['label']]
