# Vercel deployment

**Live application:** https://leaflens-black.vercel.app

**Verified production deployment:** `dpl_bFB9ESpfU41pjXSNCFwucVa6W5G4`, https://vercel.com/atul013s-projects/leaflens/bFB9ESpfU41pjXSNCFwucVa6W5G4 .

The stable domain is publicly accessible without signing into Vercel. Both models are installed and real inference/Grad-CAM were verified. GitHub's About Website field points to this URL; the source repository remains private.

LeafLens runs as a FastAPI Vercel Function, with the compiled React interface and specimen images served through Vercel's static-file support. Both trained checkpoints are bundled; no inference request needs GitHub credentials or a model download.

## Deployment package

1. Build the interface with `npm ci` and `npm run build` in `frontend/`.
2. Ensure `artifacts/cnn/best.pt` and `artifacts/vgg16/best.pt` are installed. `scripts/fetch_models.py` retrieves the repository's private model release using an authenticated GitHub CLI.
3. Run `python scripts/prepare_vercel.py` from the repository root.
4. Deploy the generated `.vercel-deploy/` directory, not the training workspace.

The preparation script copies only runtime Python modules, compiled UI assets, measured metrics and checkpoints. Dataset files, the training environment, vault notes and credentials are omitted. `.vercelignore` explicitly excludes `.env*`, `.git*`, `.vercel/` and Python caches. Deployment source/model assets total approximately 58.7 MB before CPU dependencies are installed.

The runtime uses Python 3.12 and `pyproject-deploy.toml`. Its explicit, package-specific CPU index applies only to PyTorch and Torchvision; other dependencies resolve from PyPI. A global PyTorch extra-index can cause uv to resolve unrelated packages from the wrong index, so Vercel's package is prepared without a `requirements.txt` file.

## Vercel setup

The project is `atul013s-projects/leaflens`, on the existing Hobby account. Sign in to the CLI if needed, then link the generated directory to the intended project explicitly:

```powershell
npx vercel link --yes --project leaflens --scope atul013s-projects --cwd .vercel-deploy
```

Run deployment commands from `.vercel-deploy/` after checking the linked project. The uncompressed Python bundle is approximately 858 MB, so large functions must be enabled persistently for both deployment environments:

```powershell
npx vercel env add VERCEL_SUPPORT_LARGE_FUNCTIONS 'production,preview' --value 1 --no-sensitive --yes
npx vercel env add LEAFLENS_MAX_UPLOAD_MB 'production,preview' --value 4 --no-sensitive --yes
npx vercel deploy --target preview --yes
```

Both settings are non-secret configuration values. Defining the large-function flag only with `--build-env`, or the upload limit only in a preview's deployment configuration, does not reliably carry them into a new production build created during promotion. Store both at project level for each environment. Preview protection remains enabled; use `vercel curl` from the linked directory to smoke-test it.

```powershell
npx vercel curl /api/health --deployment <preview-url> -- --silent --show-error
npx vercel promote <verified-preview-url> --yes
```

Always verify the production deployment is Ready and test its stable public alias anonymously. Promotion can create a new production build; its success must be checked independently of the preview.

## Runtime boundaries

- Cloud upload limit: **4 MB**, advertised by `/api/health` and the UI. Local execution defaults to 10 MB. This leaves room under Vercel's 4.5 MB request limit for multipart overhead.
- Attention overlays retain photo aspect ratio and are capped at 768 pixels on their longest edge, keeping responses below the platform payload limit.
- CPU inference, 120-second function limit; the UI has a 90-second analysis timeout.
- No training, dataset acquisition, persistent filesystem writes, database or third-party model API runs in production.
- Field notes remain in browser storage; the API does not persist uploaded originals.
- Serverless instances can become cold after idle periods. The first analysis may take longer while PyTorch and the checkpoint initialize.

## Update and rollback

Rebuild the UI and regenerate the package after source/model updates, deploy a preview, verify both real models, and promote only the working build. Deployment is currently driven through the authenticated CLI; automatic Git-based deployment is not configured because generated checkpoints are release assets rather than Git source.

For rollback, use the Vercel dashboard or CLI to select a previously verified production deployment. Do not change deployment protection or unrelated projects to troubleshoot LeafLens.
