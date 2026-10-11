from PIL import Image

from scripts.download_data import canonical_label, find_class_root


def test_legacy_kaggle_labels_become_standard_classes():
    assert canonical_label('Tomato_Early_blight') == 'Tomato___Early_blight'
    assert canonical_label('Tomato__Tomato_YellowLeaf__Curl_Virus') == 'Tomato___Tomato_Yellow_Leaf_Curl_Virus'
    assert canonical_label('Tomato_Spider_mites_Two_spotted_spider_mite') == 'Tomato___Spider_mites Two-spotted_spider_mite'


def test_kaggle_root_includes_single_underscore_tomato_classes(tmp_path):
    root = tmp_path / 'download' / 'PlantVillage'
    for label in ['Tomato_Early_blight', 'Tomato_healthy', 'Potato___healthy']:
        folder = root / label
        folder.mkdir(parents=True)
        Image.new('RGB', (8, 8)).save(folder / 'leaf.png')
    assert find_class_root(tmp_path / 'download') == root
