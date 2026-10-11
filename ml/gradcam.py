import numpy as np
import torch
from torch import nn


def gradcam(model, inputs, class_index):
    """Gradient-weighted activation map; handles a fully frozen backbone."""
    target = next(layer for layer in reversed(list(model.features.modules())) if isinstance(layer, nn.Conv2d))
    captured = {}

    def capture(_, __, output):
        captured['activation'] = output
        output.register_hook(lambda gradient: captured.update(gradient=gradient))

    hook = target.register_forward_hook(capture)
    try:
        model.zero_grad(set_to_none=True)
        x = inputs.detach().clone().requires_grad_(True)
        with torch.enable_grad():
            model(x)[0, class_index].backward()
        weights = captured['gradient'].mean(dim=(2, 3), keepdim=True)
        heat = (weights * captured['activation']).sum(1).relu()
        heat = torch.nn.functional.interpolate(heat.unsqueeze(1), inputs.shape[-2:], mode='bilinear', align_corners=False)[0, 0]
        heat = heat.detach().cpu().numpy()
        if heat.max() > 0:
            heat /= heat.max()
        return heat.astype(np.float32)
    finally:
        hook.remove()
        model.zero_grad(set_to_none=True)
