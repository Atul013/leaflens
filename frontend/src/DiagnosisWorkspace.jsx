import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  CircleHelp,
  Download,
  ImagePlus,
  Layers,
  Leaf,
  Plus,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sprout,
  X,
} from 'lucide-react';

const MAX_PHOTOS = 5;
const pct = (value) => `${(value * 100).toFixed(1)}%`;
const statusText = (item) =>
  ({
    ready: 'Ready',
    working: 'Analyzing',
    done: 'Analyzed',
    error: 'Try again',
  })[item.status];
function download(data, filename) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function thumbnail(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 180;
    const size = Math.min(bitmap.width, bitmap.height);
    canvas
      .getContext('2d')
      .drawImage(
        bitmap,
        (bitmap.width - size) / 2,
        (bitmap.height - size) / 2,
        size,
        size,
        0,
        0,
        180,
        180,
      );
    return canvas.toDataURL('image/jpeg', 0.65);
  } finally {
    bitmap.close();
  }
}

export default function DiagnosisWorkspace({
  health,
  samples,
  request,
  onSave,
  onGuide,
  team,
}) {
  const [items, setItems] = useState([]),
    [activeId, setActiveId] = useState(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [drag, setDrag] = useState(false);
  const [showHeat, setShowHeat] = useState(false),
    [model, setModel] = useState('vgg16');
  const input = useRef(),
    camera = useRef(),
    rows = useRef([]),
    urls = useRef(new Set());
  const alive = useRef(true),
    running = useRef(false),
    controller = useRef(null),
    generation = useRef(0),
    sampleRequest = useRef(0);
  const summaryRef = useRef();
  const limit = health?.max_upload_mb ?? 10;
  const selected = items.find((item) => item.id === activeId) || items[0];
  const result = selected?.result;
  const completed = items.filter((item) => item.status === 'done');
  const failed = items.filter((item) => item.status === 'error');
  const pending = items.filter((item) => item.status === 'ready');
  const healthy = completed.filter(
    (item) => item.result.predictions[0].healthy && !item.result.uncertain,
  ).length;
  const uncertain = completed.filter((item) => item.result.uncertain).length;
  const disease = completed.length - healthy - uncertain;
  const batch = items.length > 1;
  const hasStarted = items.some((item) => item.status !== 'ready');

  function update(updater) {
    const next = updater(rows.current);
    rows.current = next;
    setItems(next);
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
      sampleRequest.current++;
      controller.current?.abort();
      urls.current.forEach((url) => URL.revokeObjectURL(url));
      urls.current.clear();
    };
  }, []);
  useEffect(() => {
    if (!health?.available_models?.length || running.current) return;
    if (!health.available_models.includes(model))
      changeModel(health.available_models[0]);
  }, [health?.available_models?.join(','), model]);

  function addFiles(files, name = '') {
    if (running.current) return;
    sampleRequest.current++;
    const added = [],
      warnings = [];
    for (const file of Array.from(files)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        warnings.push(
          `Choose a JPEG, PNG or WebP image. ${file.name} was not added.`,
        );
        continue;
      }
      if (file.size > limit * 1024 * 1024) {
        warnings.push(
          `${file.name} exceeds ${limit} MB. Choose a smaller image.`,
        );
        continue;
      }
      if (
        [...rows.current, ...added].some(
          (item) =>
            item.file.name === file.name &&
            item.file.size === file.size &&
            item.file.lastModified === file.lastModified,
        )
      ) {
        warnings.push(`${file.name} is already selected.`);
        continue;
      }
      if (rows.current.length + added.length >= MAX_PHOTOS) {
        if (!warnings.some((w) => w.startsWith('You can')))
          warnings.push(
            'You can analyze up to 5 photos at a time. Extra photos were not added.',
          );
        continue;
      }
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      added.push({
        id: crypto.randomUUID(),
        file,
        url,
        name: name || file.name,
        status: 'ready',
        result: null,
        error: '',
      });
    }
    if (added.length) {
      update((previous) => [...previous, ...added]);
      if (!activeId) setActiveId(added[0].id);
    }
    setError(warnings.join(' '));
    if (input.current) input.current.value = '';
    if (camera.current) camera.current.value = '';
  }
  async function chooseSample(sample) {
    if (running.current) return;
    const token = ++sampleRequest.current;
    try {
      const response = await fetch(sample.url);
      if (!response.ok)
        throw new Error('Sample could not be loaded. Try another photo.');
      const blob = await response.blob();
      if (!alive.current || token !== sampleRequest.current) return;
      addFiles(
        [new File([blob], sample.url.split('/').pop(), { type: blob.type })],
        sample.name,
      );
    } catch (e) {
      if (alive.current && token === sampleRequest.current) setError(e.message);
    }
  }
  function inspect(id) {
    setActiveId(id);
    setShowHeat(false);
  }
  function remove(id) {
    if (running.current) return;
    sampleRequest.current++;
    const item = rows.current.find((row) => row.id === id);
    if (item) {
      URL.revokeObjectURL(item.url);
      urls.current.delete(item.url);
    }
    update((previous) => previous.filter((row) => row.id !== id));
    if (activeId === id) setActiveId(rows.current[0]?.id || null);
    setShowHeat(false);
    setError('');
  }
  function clear() {
    if (running.current) return;
    sampleRequest.current++;
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
    update(() => []);
    setActiveId(null);
    setShowHeat(false);
    setError('');
  }
  function changeModel(next) {
    if (running.current) return;
    setModel(next);
    setShowHeat(false);
    setError('');
    update((previous) =>
      previous.map((item) => ({
        ...item,
        result: null,
        error: '',
        status: 'ready',
      })),
    );
  }
  async function analyze(targetIds) {
    if (running.current) return;
    const targets = rows.current.filter((item) =>
      targetIds ? targetIds.includes(item.id) : item.status !== 'done',
    );
    if (!targets.length) return;
    const token = ++generation.current;
    running.current = true;
    setBusy(true);
    setError('');
    setShowHeat(false);
    for (const item of targets) {
      if (!alive.current || token !== generation.current) break;
      update((previous) =>
        previous.map((row) =>
          row.id === item.id ? { ...row, status: 'working', error: '' } : row,
        ),
      );
      const abort = new AbortController();
      controller.current = abort;
      const timer = setTimeout(() => abort.abort(), 90000);
      try {
        const body = new FormData();
        body.append('file', item.file);
        body.append('architecture', model);
        const data = await request('/api/predict', {
          method: 'POST',
          body,
          signal: abort.signal,
        });
        if (!alive.current || token !== generation.current) break;
        update((previous) =>
          previous.map((row) =>
            row.id === item.id ? { ...row, status: 'done', result: data } : row,
          ),
        );
        let image = '';
        try {
          image = await thumbnail(item.file);
        } catch {
          /* Prediction is still usable if thumbnail decoding fails. */
        }
        if (!alive.current || token !== generation.current) break;
        const { heatmap, ...summary } = data;
        onSave({
          ...summary,
          id: crypto.randomUUID(),
          thumbnail: image,
          fileName: item.file.name,
        });
      } catch (e) {
        if (!alive.current || token !== generation.current) break;
        const message =
          e.name === 'AbortError'
            ? 'Analysis timed out. Try a smaller photo or retry.'
            : e.message;
        update((previous) =>
          previous.map((row) =>
            row.id === item.id
              ? { ...row, status: 'error', error: message }
              : row,
          ),
        );
        if (targets.length === 1) setError(message);
      } finally {
        clearTimeout(timer);
      }
    }
    if (alive.current && token === generation.current) {
      running.current = false;
      setBusy(false);
      controller.current = null;
    }
  }
  function stop() {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    running.current = false;
    update((previous) =>
      previous.map((item) =>
        item.status === 'working' ? { ...item, status: 'ready' } : item,
      ),
    );
    setBusy(false);
    setError(
      'Analysis stopped. Completed results are kept; you can continue with the remaining photos.',
    );
  }
  function batchReport() {
    download(
      {
        project: 'LeafLens',
        team,
        created_at: new Date().toISOString(),
        model,
        summary: {
          selected: items.length,
          completed: completed.length,
          failed: failed.length,
          pending: items.length - completed.length - failed.length,
          healthy,
          disease_patterns: disease,
          needs_review: uncertain,
        },
        notice:
          'Research predictions from a controlled-image dataset. Confidence is uncalibrated; expert confirmation is needed. Counts describe uploaded images, not field disease prevalence.',
        images: items.map(({ file, name, status, result, error }) => ({
          fileName: file.name,
          name,
          status,
          result,
          error,
        })),
      },
      'leaflens-batch-analysis.json',
    );
  }
  const actionText = busy
    ? `Analyzing photo ${
        Math.max(
          0,
          items.findIndex((item) => item.status === 'working'),
        ) + 1
      } of ${items.length}`
    : pending.length
      ? items.length === 1
        ? 'Analyze this leaf'
        : `Analyze ${pending.length} photo${pending.length === 1 ? '' : 's'}`
      : failed.length
        ? items.length === 1
          ? 'Analyze this leaf'
          : 'Retry failed photos'
        : 'All photos analyzed';

  return (
    <>
      <p
        className="visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {items.length > 0
          ? `${completed.length} of ${items.length} analyzed${busy ? ', analysis in progress' : failed.length ? `, ${failed.length} need another try` : pending.length ? `, ${pending.length} ready to analyze` : ', analysis complete'}.`
          : 'Add up to five leaf photos to begin.'}
        {result
          ? ` Current photo: ${selected.file.name}. ${result.predictions[0].crop}, ${result.predictions[0].condition}, ${pct(result.confidence)} uncalibrated confidence.${result.uncertain ? ' Needs a closer look.' : ''}`
          : selected?.status === 'error'
            ? ` ${selected.error}`
            : ''}
      </p>
      <div className="batch-toolbar">
        <div>
          <span className="batch-icon">
            <Layers size={20} />
          </span>
          <div>
            <h2>A little perspective. Up to five leaves.</h2>
            <p>Compare photos together, then look closer at each one.</p>
          </div>
        </div>
        <div className="batch-shortcuts">
          {batch && hasStarted && (
            <button
              className="text-button"
              onClick={() =>
                summaryRef.current?.scrollIntoView({
                  behavior: matchMedia('(prefers-reduced-motion: reduce)')
                    .matches
                    ? 'instant'
                    : 'smooth',
                  block: 'start',
                })
              }
            >
              View batch summary <ArrowRight size={14} />
            </button>
          )}
          <span className="selection-count">{items.length} / 5 photos</span>
        </div>
      </div>
      {items.length > 0 && (
        <div className="contact-sheet" aria-label="Selected photos">
          <div className="specimen-tabs">
            {items.map((item) => (
              <div
                className={`specimen-tab ${selected?.id === item.id ? 'selected' : ''} ${item.status}`}
                key={item.id}
              >
                <button
                  className="specimen-select"
                  onClick={() => inspect(item.id)}
                  aria-pressed={selected?.id === item.id}
                  aria-label={`Inspect ${item.file.name}`}
                >
                  <span className="thumb-wrap">
                    <img src={item.url} alt="" />
                    {item.status === 'done' && (
                      <span className="thumb-check">
                        <Check size={12} />
                      </span>
                    )}
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      <span
                        className={
                          item.status === 'working' ? 'status-pulse' : ''
                        }
                      />
                      {statusText(item)}
                    </small>
                  </span>
                </button>
                <button
                  className="remove-specimen"
                  onClick={() => remove(item.id)}
                  disabled={busy}
                  aria-label={`Remove ${item.file.name}`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {items.length < MAX_PHOTOS && (
              <button
                className="add-specimen"
                disabled={busy}
                onClick={() => input.current.click()}
              >
                <Plus size={20} />
                <span>Add photos</span>
              </button>
            )}
          </div>
          <button
            className="text-button clear-photos"
            onClick={clear}
            disabled={busy}
          >
            Clear photos
          </button>
        </div>
      )}
      <section
        className="diagnostic-grid batch-workspace"
        aria-label="Leaf diagnosis workspace"
      >
        <div className="specimen-panel">
          <div className="panel-top">
            <span>
              <ScanLine size={16} />
              {selected
                ? `Leaf ${items.indexOf(selected) + 1} of ${items.length}`
                : 'Leaf specimens'}
            </span>
            <span className="subtle">
              {selected ? statusText(selected) : 'One photo per leaf'}
            </span>
          </div>
          <div
            className={`specimen ${selected ? 'has-photo' : ''} ${drag ? 'dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              addFiles(e.dataTransfer.files);
            }}
          >
            {selected ? (
              <img
                className="specimen-image"
                src={selected.url}
                alt={`Selected crop leaf for analysis: ${selected.file.name}`}
              />
            ) : (
              <div className="specimen-art">
                <img
                  src="/botanical.jpg"
                  alt="Green foliage photographed in natural light"
                />
                <div className="photo-shade" />
                <div className="photo-label">
                  <span className="photo-dot" /> A little attention goes a long
                  way.
                </div>
              </div>
            )}
            {selected && showHeat && result && (
              <img
                className="heat-overlay"
                src={result.heatmap}
                alt="Grad-CAM model attention overlay"
              />
            )}
            <div className="scan-corners" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </div>
            {selected?.status === 'working' && (
              <div className="scanning">
                <div className="scan-sweep" />
                <span>
                  <span className="spinner" />
                  Reading leaf patterns…
                </span>
              </div>
            )}
            {!selected && (
              <button
                className="photo-upload"
                onClick={() => input.current.click()}
              >
                <ImagePlus size={18} /> Add leaf photos
              </button>
            )}
            {selected && (
              <div className="image-tools">
                <span>{selected.name}</span>
                <button
                  disabled={busy}
                  onClick={() => remove(selected.id)}
                  aria-label="Remove leaf photo"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            {drag && (
              <div className="drop-invitation">
                <ImagePlus size={30} />
                <strong>Drop your leaf photos here</strong>
                <span>Up to {MAX_PHOTOS - items.length} more</span>
              </div>
            )}
          </div>
          <div className="upload-footer">
            <div>
              <strong>One leaf per photo. A clearer comparison.</strong>
              <span>JPEG, PNG or WebP · Up to {limit} MB each</span>
            </div>
            <button
              className="icon-button camera-button"
              onClick={() => camera.current.click()}
              disabled={busy || items.length === MAX_PHOTOS}
              aria-label="Take a leaf photo"
            >
              <Camera size={20} />
            </button>
          </div>
          {items.length > 0 && items.length < MAX_PHOTOS && (
            <button
              className="add-more-photos"
              disabled={busy}
              onClick={() => input.current.click()}
            >
              <Plus size={16} />
              Add more photos
              <span>
                {MAX_PHOTOS - items.length} space
                {MAX_PHOTOS - items.length === 1 ? '' : 's'} left
              </span>
            </button>
          )}
          <input
            ref={input}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="visually-hidden"
            aria-label="Upload leaf photo"
            disabled={busy}
            onChange={(e) => addFiles(e.target.files)}
          />
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            className="visually-hidden"
            aria-label="Capture leaf photo"
            disabled={busy}
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>
        <div className="analysis-panel">
          <div className="panel-top">
            <span>
              <Layers size={16} />
              {batch ? 'A closer look' : "The leaf's story"}
            </span>
            <span className="subtle">
              {result ? 'Analysis complete' : 'Visual analysis'}
            </span>
          </div>
          <label className="model-choice">
            <span>Analysis model</span>
            <select
              aria-label="Analysis model"
              value={model}
              disabled={busy}
              onChange={(e) => changeModel(e.target.value)}
            >
              <option value="vgg16">VGG16 transfer learning</option>
              <option value="cnn">Custom CNN baseline</option>
            </select>
          </label>
          {result ? (
            <div className="results">
              <div
                className={`result-tag ${result.uncertain ? 'caution' : ''}`}
              >
                <span />
                {result.uncertain
                  ? 'Needs a closer look'
                  : result.predictions[0].healthy
                    ? 'Healthy pattern detected'
                    : 'Disease pattern detected'}
              </div>
              <span className="result-crop">{result.predictions[0].crop}</span>
              <h2>{result.predictions[0].condition}</h2>
              <p>{result.predictions[0].symptoms}</p>
              <div className="confidence">
                <span>
                  Model confidence <CircleHelp size={13} />
                </span>
                <strong>{pct(result.confidence)}</strong>
              </div>
              <div className="confidence-track">
                <span style={{ width: pct(result.confidence) }} />
              </div>
              <p className="confidence-note">
                An uncalibrated probability, not a certainty.
              </p>
              <div className="alternative-heading">Other possible patterns</div>
              {result.predictions.slice(1).map((p) => (
                <div className="alternative" key={p.id}>
                  <span>
                    {p.crop} · {p.condition}
                  </span>
                  <strong>{pct(p.probability)}</strong>
                </div>
              ))}
              <label className="heat-switch">
                <span>
                  <ScanLine size={18} /> Show model attention{' '}
                  <small>Grad-CAM</small>
                </span>
                <input
                  type="checkbox"
                  checked={showHeat}
                  onChange={(e) => setShowHeat(e.target.checked)}
                />
                <i aria-hidden="true" />
              </label>
              <div className="observation-guidance">
                <h3>
                  <Leaf size={17} />
                  What to look for next
                </h3>
                <ul>
                  {result.predictions[0].guidance?.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
                <p>
                  Confirm observations with an agricultural expert before
                  treatment.
                </p>
              </div>
              <div className="result-actions">
                <button
                  className="secondary-button"
                  onClick={() =>
                    download(
                      {
                        ...result,
                        fileName: selected.file.name,
                        team,
                        project: 'LeafLens',
                      },
                      'leaflens-analysis.json',
                    )
                  }
                >
                  <Download size={16} />
                  Save analysis
                </button>
                <button
                  className="text-button"
                  onClick={() => onGuide(result.predictions[0])}
                >
                  Observation guide <ArrowRight size={15} />
                </button>
              </div>
              <p className="inference-meta">
                {result.architecture.toUpperCase()} ·{' '}
                {(result.elapsed_ms / 1000).toFixed(2)} seconds · Research
                prediction
              </p>
            </div>
          ) : (
            <div className="analysis-empty">
              <div className="empty-icon">
                <Sprout size={32} strokeWidth={1.4} />
              </div>
              <h2>
                {selected?.status === 'working'
                  ? 'One leaf at a time. The whole picture.'
                  : selected?.status === 'error'
                    ? 'This leaf needs another try.'
                    : batch
                      ? 'Different leaves. One clear view.'
                      : 'Every leaf tells a story.'}
              </h2>
              <p>
                {selected?.status === 'error'
                  ? selected.error
                  : busy
                    ? 'Each photo gets its own prediction and attention map. You can inspect completed leaves while the others finish.'
                    : 'Add up to five clear photos. Compare possible disease patterns, then explore the details of each leaf.'}
              </p>
              <div className="analysis-steps">
                <div>
                  <Check size={16} />
                  <span>Individual crop and disease predictions</span>
                </div>
                <div>
                  <Check size={16} />
                  <span>Confidence and alternative matches</span>
                </div>
                <div>
                  <Check size={16} />
                  <span>Attention maps and observation guidance</span>
                </div>
              </div>
            </div>
          )}
          <div className="batch-action-area">
            <button
              className="analyze-button"
              disabled={
                busy || (items.length > 0 && !pending.length && !failed.length)
              }
              onClick={() => (items.length ? analyze() : input.current.click())}
            >
              <ScanLine size={19} />
              {items.length ? actionText : 'Upload leaf photos'}
              {!busy && <ArrowUpRight size={19} />}
            </button>
            {busy && (
              <button className="text-button" onClick={stop}>
                Stop analysis
              </button>
            )}
            <span className="local-note">
              <ShieldCheck size={14} />
              Original photos are not retained by this service.
            </span>
          </div>
        </div>
      </section>
      {error && (
        <div className="error-message batch-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            aria-label="Dismiss upload error"
            onClick={() => setError('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {batch && hasStarted && (
        <section
          className="batch-overview"
          ref={summaryRef}
          aria-labelledby="batch-summary-title"
        >
          <div className="batch-overview-heading">
            <div>
              <span className="batch-eyebrow">Across your photos</span>
              <h2 id="batch-summary-title">Your batch at a glance</h2>
              <p>
                {completed.length} of {items.length} analyzed
                {busy
                  ? ', analysis in progress'
                  : failed.length
                    ? `, ${failed.length} need another try`
                    : pending.length
                      ? `, ${pending.length} ready to analyze`
                      : '. Select a photo to inspect its details.'}
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={batchReport}
              disabled={busy || completed.length === 0}
            >
              <Download size={16} />
              Download batch report
            </button>
          </div>
          <div className="batch-findings">
            <span>
              <i className="finding-dot healthy" />
              <strong>{healthy}</strong> healthy pattern
              {healthy === 1 ? '' : 's'}
            </span>
            <span>
              <i className="finding-dot disease" />
              <strong>{disease}</strong> disease pattern
              {disease === 1 ? '' : 's'}
            </span>
            <span>
              <i className="finding-dot review" />
              <strong>{uncertain}</strong> need review
            </span>
            <small>
              Completed photos only. These are image predictions, not a field
              diagnosis.
            </small>
          </div>
          <div className="comparison-table">
            <div className="comparison-head" aria-hidden="true">
              <span>Photo</span>
              <span>Top pattern</span>
              <span>Confidence</span>
              <span>Review</span>
            </div>
            {items.map((item) => (
              <button
                className={`comparison-row ${item.id === selected?.id ? 'active' : ''}`}
                key={item.id}
                onClick={() => {
                  inspect(item.id);
                  document.querySelector('.batch-workspace')?.scrollIntoView({
                    behavior: matchMedia('(prefers-reduced-motion: reduce)')
                      .matches
                      ? 'instant'
                      : 'smooth',
                    block: 'start',
                  });
                }}
                aria-label={`View analysis for ${item.file.name}. ${item.result ? `${item.result.predictions[0].crop}, ${item.result.predictions[0].condition}, ${pct(item.result.confidence)} uncalibrated confidence. ${item.result.uncertain ? 'Needs a closer look' : 'Analyzed'}` : item.error || statusText(item)}`}
              >
                <span className="comparison-photo">
                  <img src={item.url} alt="" />
                  <span>
                    <strong>{item.file.name}</strong>
                    <small>
                      {item.result?.predictions[0].crop || statusText(item)}
                    </small>
                  </span>
                </span>
                <span className="comparison-pattern">
                  {item.result?.predictions[0].condition ||
                    (item.status === 'error' ? item.error : statusText(item))}
                </span>
                <span className="comparison-confidence">
                  {item.result ? (
                    <>
                      <strong>{pct(item.result.confidence)}</strong>
                      <i>
                        <span style={{ width: pct(item.result.confidence) }} />
                      </i>
                    </>
                  ) : (
                    '—'
                  )}
                </span>
                <span
                  className={`comparison-review ${item.status === 'error' || item.result?.uncertain ? 'needs-review' : ''}`}
                >
                  {item.status === 'done'
                    ? item.result.uncertain
                      ? 'Closer look'
                      : 'Analyzed'
                    : statusText(item)}
                  <ArrowUpRight size={15} />
                </span>
              </button>
            ))}
          </div>
          {failed.length > 0 && !busy && (
            <div className="batch-retry">
              <span>
                <AlertCircle size={16} />
                Successful results are kept. Retry only the photos that failed.
              </span>
              <button
                className="secondary-button"
                onClick={() => analyze(failed.map((item) => item.id))}
              >
                Retry {failed.length} photo{failed.length === 1 ? '' : 's'}
              </button>
            </div>
          )}
        </section>
      )}
      {samples.length > 0 && (
        <section className="sample-section">
          <div className="section-caption">
            <h3>No photo on hand?</h3>
            <span>Add real held-out samples to your selection.</span>
          </div>
          <div className="sample-list">
            {samples.slice(0, 4).map((sample) => (
              <button
                className="sample"
                key={sample.url}
                disabled={busy || items.length === MAX_PHOTOS}
                onClick={() => chooseSample(sample)}
              >
                <img src={sample.url} alt="" />
                <span>
                  <strong>{sample.crop}</strong>
                  <small>{sample.name}</small>
                </span>
                <Plus size={16} />
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
