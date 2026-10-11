import torch
from torch import nn


class LeafVGG(nn.Module):
    """VGG16 convolutional backbone + global pooling + compact disease head.

    Avoids the original 123M-parameter fully connected ImageNet classifier.
    """
    def __init__(self, classes: int, pretrained=False):
        super().__init__()
        from torchvision.models import vgg16, VGG16_Weights
        if pretrained:
            self.features = vgg16(weights=VGG16_Weights.IMAGENET1K_V1).features
        else:
            # Checkpoints store only this backbone and the compact head. Avoid
            # allocating the unused 123M-parameter ImageNet classifier on load.
            from torchvision.models.vgg import cfgs, make_layers
            self.features = make_layers(cfgs['D'])
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.classifier = nn.Sequential(nn.Flatten(), nn.Linear(512, 256), nn.ReLU(), nn.Dropout(.35), nn.Linear(256, classes))

    def forward(self, x):
        return self.classifier(self.pool(self.features(x)))

    def set_stage(self, fine_tune=False):
        for parameter in self.features.parameters():
            parameter.requires_grad = False
        if fine_tune:
            for layer in list(self.features.children())[24:]:
                for parameter in layer.parameters():
                    parameter.requires_grad = True


class LeafCNN(nn.Module):
    def __init__(self, classes: int, pretrained=False):
        super().__init__()
        layers, previous = [], 3
        for channels in [32, 64, 128, 256]:
            layers += [nn.Conv2d(previous, channels, 3, padding=1), nn.BatchNorm2d(channels),
                       nn.ReLU(), nn.MaxPool2d(2)]
            previous = channels
        self.features = nn.Sequential(*layers)
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.classifier = nn.Sequential(nn.Flatten(), nn.Dropout(.3), nn.Linear(256, classes))

    def forward(self, x):
        return self.classifier(self.pool(self.features(x)))


def create_model(architecture: str, classes: int, pretrained=False):
    if architecture == 'vgg16':
        return LeafVGG(classes, pretrained)
    if architecture == 'cnn':
        return LeafCNN(classes)
    raise ValueError(f'Unknown architecture: {architecture}')


def load_checkpoint(path, device='cpu'):
    checkpoint = torch.load(path, map_location='cpu', weights_only=True)
    model = create_model(checkpoint['architecture'], len(checkpoint['classes']))
    model.load_state_dict(checkpoint['state_dict'])
    model.to(device).eval()
    return model, checkpoint
