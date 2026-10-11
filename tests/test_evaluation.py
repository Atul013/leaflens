import math

import pytest
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from ml.evaluate import evaluate
from ml.gradcam import gradcam
from ml.models import create_model


def test_evaluation_confusion_macro_f1_and_calibration_are_measured():
    logits = torch.tensor([[math.log(.8), math.log(.2)], [math.log(.2), math.log(.8)],
                           [math.log(.2), math.log(.8)], [math.log(.2), math.log(.8)]])
    loader = DataLoader(TensorDataset(logits, torch.tensor([0, 0, 1, 1])), batch_size=2)
    result = evaluate(nn.Identity(), loader, ['healthy', 'disease'], torch.device('cpu'))
    assert result['accuracy'] == .75
    assert result['macro_f1'] == pytest.approx(.7333333333)
    assert result['confusion_matrix'] == [[1, 1], [0, 2]]
    assert result['calibration']['ece'] == pytest.approx(.05, abs=1e-6)
    assert result['test_samples'] == 4


def test_gradcam_works_with_frozen_backbone_and_cleans_hooks():
    torch.manual_seed(3)
    model = create_model('cnn', 2).eval()
    for parameter in model.features.parameters():
        parameter.requires_grad = False
    inputs = torch.randn(1, 3, 64, 64)
    heat = gradcam(model, inputs, 0)
    assert heat.shape == (64, 64)
    assert bool(torch.tensor(heat).isfinite().all())
    assert heat.min() >= 0 and heat.max() <= 1
    assert all(not layer._forward_hooks for layer in model.features.modules())
