import json
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score


def evaluate(model, loader, classes, device):
    model.eval()
    actual, predictions, probabilities = [], [], []
    with torch.inference_mode():
        for images, labels in loader:
            probs = model(images.to(device)).softmax(1).cpu()
            probabilities.extend(probs.tolist())
            predictions.extend(probs.argmax(1).tolist())
            actual.extend(labels.tolist())
    labels = list(range(len(classes)))
    probs = np.array(probabilities)
    confidence = probs.max(1)
    correct = np.array(actual) == np.array(predictions)
    bins, ece = [], 0.
    for lo in np.linspace(0, .9, 10):
        mask = (confidence >= lo) & (confidence < lo+.1 if lo < .9 else confidence <= 1)
        count = int(mask.sum())
        accuracy = float(correct[mask].mean()) if count else None
        mean_confidence = float(confidence[mask].mean()) if count else None
        if count:
            ece += count/len(actual) * abs(accuracy-mean_confidence)
        bins.append({'lower': float(lo), 'count': count, 'accuracy': accuracy, 'confidence': mean_confidence})
    return {'accuracy': float(accuracy_score(actual, predictions)),
            'macro_f1': float(f1_score(actual, predictions, labels=labels, average='macro', zero_division=0)),
            'weighted_f1': float(f1_score(actual, predictions, labels=labels, average='weighted', zero_division=0)),
            'classification_report': classification_report(actual, predictions, labels=labels, target_names=classes, output_dict=True, zero_division=0),
            'confusion_matrix': confusion_matrix(actual, predictions, labels=labels).tolist(),
            'calibration': {'ece': float(ece), 'bins': bins}, 'test_samples': len(actual), 'classes': classes}


def save_figures(metrics, history, output):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    output = Path(output)
    fig, ax = plt.subplots(figsize=(12, 10))
    matrix = np.array(metrics['confusion_matrix'])
    image = ax.imshow(matrix, cmap='Greens')
    ax.set(xticks=range(len(metrics['classes'])), yticks=range(len(metrics['classes'])),
           xticklabels=metrics['classes'], yticklabels=metrics['classes'], xlabel='Predicted class', ylabel='True class', title='Held-out test confusion matrix')
    plt.setp(ax.get_xticklabels(), rotation=90, fontsize=7)
    plt.setp(ax.get_yticklabels(), fontsize=7)
    fig.colorbar(image, ax=ax)
    fig.tight_layout()
    fig.savefig(output / 'confusion-matrix.png', dpi=150)
    plt.close(fig)
    fig, axes = plt.subplots(1, 2, figsize=(10, 4))
    epochs = [r['epoch'] for r in history]
    for ax, field in zip(axes, ['loss', 'accuracy']):
        ax.plot(epochs, [r[f'train_{field}'] for r in history], label='Train')
        ax.plot(epochs, [r[f'val_{field}'] for r in history], label='Validation')
        ax.set(xlabel='Epoch', ylabel=field.title())
        ax.legend()
    fig.tight_layout()
    fig.savefig(output / 'training-curves.png', dpi=150)
    plt.close(fig)
