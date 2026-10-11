"""Generate a portable training notebook with no fabricated execution outputs."""
import json
from pathlib import Path


def main():
    cells = []

    def markdown(text):
        cells.append({'cell_type': 'markdown', 'metadata': {}, 'source': text.splitlines(keepends=True)})

    def code(text):
        cells.append({'cell_type': 'code', 'metadata': {}, 'execution_count': None, 'outputs': [], 'source': text.splitlines(keepends=True)})

    markdown('# LeafLens training notebook\n\nAtul Biju ASI23CA023 · Athul M B ASI23CA022 · Athul Chandran ASI23CA021\n\nRun on a Colab GPU or in the project directory. Subset results are not a full Kaggle benchmark. This notebook contains instructions, not fabricated executed results.')
    code('# On Colab, clone using your own authenticated access if the repository is private.\n# !git clone https://github.com/Atul013/leaflens.git\n# %cd leaflens\n!pip install -r requirements.txt')
    markdown('## Week 1: dataset collection\nUse the assigned Kaggle route. The alternative retrieves an explicitly documented upstream subset.')
    code('!python scripts/download_data.py\n# Alternative: !python scripts/download_subset.py --per-class 100')
    code('from pathlib import Path\nfrom ml.data import build_manifest\nimport collections\nDATA = Path("data/PlantVillage")\nmanifest = build_manifest(DATA, seed=42)\nprint(manifest["classes"])\nprint(collections.Counter(row["split"] for row in manifest["samples"]))\nprint("Exact duplicates removed:", manifest["duplicates_removed"])')
    markdown('## Week 1: custom CNN baseline\nFour convolutional blocks, global pooling and dropout. Check the manifest before training.')
    code('!python -m ml.train --data data/PlantVillage --architecture cnn --epochs 12')
    markdown('## Week 2: VGG16 base training and fine-tuning\nTrain the head for four epochs, then unfreeze the final convolutional block at a smaller learning rate.')
    code('!python -m ml.train --data data/PlantVillage --architecture vgg16 --epochs 12 --freeze-epochs 4')
    markdown('## Evaluation and visualization\nTest images are held out from checkpoint selection. Compare split fingerprints before comparing models.')
    code('import json\nfrom IPython.display import display, Image\nruns = [json.loads(Path(f"artifacts/{arch}/metrics.json").read_text()) for arch in ["cnn", "vgg16"]]\nassert runs[0]["manifest_hash"] == runs[1]["manifest_hash"]\nfor run in runs:\n    arch = run["architecture"]\n    print(arch, "accuracy", run["accuracy"], "macro F1", run["macro_f1"], "ECE", run["calibration"]["ece"])\n    display(Image(filename=f"artifacts/{arch}/training-curves.png"))\n    display(Image(filename=f"artifacts/{arch}/confusion-matrix.png"))')
    code('!python scripts/publish_results.py')
    markdown('## Interpretation\nControlled backgrounds do not establish field performance. Exact duplicates are removed, but physical-leaf grouping is not verified. Confidence is uncalibrated. Grad-CAM is a sensitivity map, not lesion segmentation. See docs/REPORT.md and docs/VIVA.md. Completed local measured outputs are saved separately in docs/results/.')
    path = Path(__file__).resolve().parents[1] / 'notebooks/LeafLens_Training.ipynb'
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps({'cells': cells, 'metadata': {'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'},
                    'language_info': {'name': 'python', 'version': '3.12'}}, 'nbformat': 4, 'nbformat_minor': 5}, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
