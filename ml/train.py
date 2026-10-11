"""python -m ml.train --data data/PlantVillage --architecture vgg16"""
import argparse
import hashlib
import json
import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader

from ml.data import LeafDataset, build_manifest
from ml.evaluate import evaluate, save_figures
from ml.models import create_model, load_checkpoint

_STATUS_PATH = None


def mark_failed(error):
    if _STATUS_PATH is not None and _STATUS_PATH.exists():
        status = json.loads(_STATUS_PATH.read_text())
        status.update(state='failed', error=type(error).__name__, finished_at=datetime.now(timezone.utc).isoformat())
        _STATUS_PATH.write_text(json.dumps(status))


def epoch(model, loader, criterion, device, optimizer=None, scaler=None):
    model.train(optimizer is not None)
    loss_sum, correct, count = 0., 0, 0
    with torch.set_grad_enabled(optimizer is not None):
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            if optimizer is not None:
                optimizer.zero_grad(set_to_none=True)
            with torch.amp.autocast(device.type, enabled=device.type == 'cuda'):
                logits = model(images)
                loss = criterion(logits, labels)
            if optimizer is not None:
                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()
            count += len(labels)
            loss_sum += loss.item()*len(labels)
            correct += (logits.argmax(1) == labels).sum().item()
    return loss_sum/count, correct/count


def main():
    global _STATUS_PATH
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--architecture', choices=['cnn', 'vgg16'], default='vgg16')
    parser.add_argument('--output', type=Path, default=None)
    parser.add_argument('--epochs', type=int, default=12)
    parser.add_argument('--freeze-epochs', type=int, default=4)
    parser.add_argument('--batch-size', type=int, default=16)
    parser.add_argument('--image-size', type=int, default=224)
    parser.add_argument('--max-per-class', type=int)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--workers', type=int, default=0)
    parser.add_argument('--patience', type=int, default=4)
    parser.add_argument('--cpu', action='store_true')
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1 or args.image_size < 32 or args.patience < 1:
        parser.error('epochs, batch-size and patience must be positive; image-size >= 32')
    if args.architecture == 'vgg16' and not 0 < args.freeze_epochs < args.epochs:
        parser.error('VGG16 needs 0 < freeze-epochs < epochs to exercise both training stages')
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.set_num_threads(4)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
    device = torch.device('cuda' if torch.cuda.is_available() and not args.cpu else 'cpu')
    output = args.output or Path('artifacts') / args.architecture
    output.mkdir(parents=True, exist_ok=True)
    manifest = build_manifest(args.data, args.seed, args.max_per_class)
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    manifest_hash = hashlib.sha256(json.dumps(manifest['samples'], sort_keys=True).encode()).hexdigest()
    provenance_path = args.data / 'provenance.json'
    provenance = json.loads(provenance_path.read_text()) if provenance_path.exists() else {}
    acquisition_subset = provenance.get('subset', False) or 'subset' in args.data.name.lower()
    status = {'state': 'training', 'manifest_hash': manifest_hash, 'started_at': datetime.now(timezone.utc).isoformat()}
    _STATUS_PATH = output / 'run-status.json'
    _STATUS_PATH.write_text(json.dumps(status))
    loaders = {split: DataLoader(LeafDataset(manifest, split, split == 'train', args.image_size), batch_size=args.batch_size,
                               shuffle=split == 'train', num_workers=args.workers, pin_memory=device.type == 'cuda',
                               generator=torch.Generator().manual_seed(args.seed)) for split in ['train', 'val', 'test']}
    model = create_model(args.architecture, len(manifest['classes']), pretrained=args.architecture == 'vgg16').to(device)
    counts = np.bincount([manifest['classes'].index(r['label']) for r in manifest['samples'] if r['split'] == 'train'])
    weights = torch.tensor(len(loaders['train'].dataset) / (len(counts)*counts), dtype=torch.float32, device=device)
    criterion = nn.CrossEntropyLoss(weight=weights, label_smoothing=.05)
    scaler = torch.amp.GradScaler('cuda', enabled=device.type == 'cuda')
    history, best, stale, current_stage = [], -1., 0, None
    started = time.time()
    print(f'Device: {device}; classes: {len(counts)}; splits: ' + str({k: len(v.dataset) for k, v in loaders.items()}), flush=True)
    for number in range(args.epochs):
        stage = 'fine_tune' if args.architecture == 'vgg16' and number >= args.freeze_epochs else 'frozen' if args.architecture == 'vgg16' else 'baseline'
        if stage != current_stage:
            if args.architecture == 'vgg16':
                model.set_stage(stage == 'fine_tune')
            optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=1e-5 if stage == 'fine_tune' else 1e-3, weight_decay=1e-4)
            scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', patience=2, factor=.5)
            current_stage, stale = stage, 0
        train_loss, train_acc = epoch(model, loaders['train'], criterion, device, optimizer, scaler)
        val_loss, val_acc = epoch(model, loaders['val'], criterion, device)
        scheduler.step(val_acc)
        history.append({'epoch': number+1, 'stage': stage, 'train_loss': train_loss, 'train_accuracy': train_acc, 'val_loss': val_loss, 'val_accuracy': val_acc, 'lr': optimizer.param_groups[0]['lr']})
        print(json.dumps(history[-1]), flush=True)
        if val_acc > best:
            best, stale = val_acc, 0
            torch.save({'state_dict': model.state_dict(), 'architecture': args.architecture, 'classes': manifest['classes'],
                        'image_size': args.image_size, 'epoch': number+1, 'stage': stage, 'manifest_hash': manifest_hash}, output / 'best.pending.pt')
            os.replace(output / 'best.pending.pt', output / 'best.pt')
        else:
            stale += 1
        (output / 'history.json').write_text(json.dumps(history, indent=2))
        # Do not stop before the fine-tuning phase has actually happened.
        if stale >= args.patience and (args.architecture == 'cnn' or stage == 'fine_tune'):
            break
    model, checkpoint = load_checkpoint(output / 'best.pt', device)
    if args.architecture == 'vgg16':
        model.set_stage(checkpoint['stage'] == 'fine_tune')
    metrics = evaluate(model, loaders['test'], manifest['classes'], device)
    metrics.update({'architecture': args.architecture, 'best_epoch': checkpoint['epoch'], 'best_stage': checkpoint['stage'],
                    'history': history, 'duration_seconds': time.time()-started, 'created_at': datetime.now(timezone.utc).isoformat(),
                    'manifest_hash': manifest_hash, 'dataset': 'PlantVillage',
                    'acquisition': provenance.get('route', 'upstream GitHub subset' if acquisition_subset else 'user-provided or Kaggle dataset'),
                    'subset': acquisition_subset or args.max_per_class is not None,
                    'max_per_class': args.max_per_class or provenance.get('per_class'), 'training_cap': args.max_per_class,
                    'split_counts': {k: len(v.dataset) for k, v in loaders.items()}, 'duplicates_removed': manifest['duplicates_removed'],
                    'device': str(device), 'torch_version': str(torch.__version__), 'image_size': args.image_size,
                    'trainable_parameters': sum(p.numel() for p in model.parameters() if p.requires_grad),
                    'parameters': sum(p.numel() for p in model.parameters()), 'seed': args.seed,
                    'limitations': ['Controlled-background dataset; field generalization is unverified.', 'Exact duplicates removed; near duplicates and physical-leaf grouping are not verified.', 'Softmax confidence is not calibrated.', 'No external validation dataset.']})
    (output / 'metrics.json').write_text(json.dumps(metrics, indent=2))
    save_figures(metrics, history, output)
    (output / 'run-status.json').write_text(json.dumps({**status, 'state': 'complete'}))
    print(f'Test accuracy: {metrics["accuracy"]:.4f}; macro F1: {metrics["macro_f1"]:.4f}; saved to {output}', flush=True)


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        mark_failed(error)
        raise
