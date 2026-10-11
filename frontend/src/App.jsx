import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Upload,
  Leaf,
  ScanLine,
  BookOpen,
  FlaskConical,
  History,
  ChevronRight,
  Check,
  X,
  Camera,
  Download,
  RefreshCw,
  AlertCircle,
  Sprout,
  Layers,
  ShieldCheck,
  Trash2,
  Search,
  ImagePlus,
  ArrowRight,
  CircleHelp,
  Menu,
} from 'lucide-react';

const pct = (value) => `${(value * 100).toFixed(1)}%`;
const NAV = [
  ['diagnose', 'Diagnose', ScanLine],
  ['atlas', 'Disease atlas', BookOpen],
  ['lab', 'Model lab', FlaskConical],
  ['history', 'Field notes', History],
];
const TEAM = [
  'Atul Biju · ASI23CA023',
  'Athul M B · ASI23CA022',
  'Athul Chandran · ASI23CA021',
];
function readHistory() {
  try {
    const data = JSON.parse(localStorage.getItem('leaflens-history') || '[]');
    return Array.isArray(data)
      ? data
          .filter(
            (e) =>
              e &&
              typeof e.id === 'string' &&
              Array.isArray(e.predictions) &&
              e.predictions[0] &&
              typeof e.predictions[0].condition === 'string' &&
              typeof e.architecture === 'string' &&
              typeof e.confidence === 'number',
          )
          .slice(0, 20)
      : [];
  } catch {
    return [];
  }
}
async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.detail || 'Request failed. Try again.');
  return data;
}
function App() {
  const [page, setPage] = useState('diagnose'),
    [health, setHealth] = useState(null),
    [offline, setOffline] = useState(false),
    [library, setLibrary] = useState([]),
    [experiments, setExperiments] = useState([]),
    [samples, setSamples] = useState([]),
    [history, setHistory] = useState(readHistory),
    [menu, setMenu] = useState(false);
  const [file, setFile] = useState(null),
    [preview, setPreview] = useState(null),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [showHeat, setShowHeat] = useState(false),
    [drag, setDrag] = useState(false),
    [sampleName, setSampleName] = useState(''),
    [query, setQuery] = useState(''),
    [crop, setCrop] = useState('All crops'),
    [selectedDisease, setSelectedDisease] = useState(null),
    [modelIndex, setModelIndex] = useState(0),
    [modelChoice, setModelChoice] = useState('vgg16');
  const uploadLimit = health?.max_upload_mb ?? 10;
  const input = useRef(),
    camera = useRef(),
    activeUrl = useRef(),
    resultRef = useRef(),
    requestId = useRef(0),
    busyRef = useRef(false),
    historyRef = useRef(history);
  function updateNotes(updater) {
    const next = updater(historyRef.current);
    historyRef.current = next;
    setHistory(next);
    try {
      localStorage.setItem('leaflens-history', JSON.stringify(next));
    } catch {
      setError(
        'Field notes could not be saved on this device. Download the result to keep it.',
      );
    }
  }
  function refresh() {
    api('/api/health')
      .then((v) => {
        setHealth(v);
        setOffline(false);
        setModelChoice((previous) =>
          v.available_models?.includes(previous)
            ? previous
            : v.architecture || previous,
        );
      })
      .catch(() => {
        setHealth(null);
        setOffline(true);
      });
    api('/api/library')
      .then((v) => setLibrary(v.classes))
      .catch(() => {});
    api('/api/metrics')
      .then((v) => setExperiments(v.experiments))
      .catch(() => {});
  }
  useEffect(() => {
    refresh();
    fetch('/samples/catalog.json')
      .then((r) => (r.ok ? r.json() : []))
      .then(setSamples)
      .catch(() => {});
    const timer = setInterval(refresh, 30000);
    return () => {
      clearInterval(timer);
      if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    };
  }, []);
  function selectFile(next, name = '') {
    if (busyRef.current) return;
    requestId.current++;
    setError('');
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
      setError('Choose a JPEG, PNG or WebP image.');
      return;
    }
    if (next.size > uploadLimit * 1024 * 1024) {
      setError(`This photo exceeds ${uploadLimit} MB. Choose a smaller image.`);
      return;
    }
    setResult(null);
    setShowHeat(false);
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    const url = URL.createObjectURL(next);
    activeUrl.current = url;
    setPreview(url);
    setFile(next);
    setSampleName(name);
    if (input.current) input.current.value = '';
  }
  async function chooseSample(sample) {
    if (busyRef.current) return;
    const id = ++requestId.current;
    try {
      const response = await fetch(sample.url);
      if (!response.ok) throw new Error('Sample could not be loaded.');
      const blob = await response.blob();
      if (id !== requestId.current) return;
      selectFile(
        new File([blob], sample.url.split('/').pop(), { type: blob.type }),
        sample.name,
      );
    } catch (e) {
      setError(e.message);
    }
  }
  async function analyze() {
    if (!file || busyRef.current) return;
    const id = ++requestId.current;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setResult(null);
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 90000);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('architecture', modelChoice);
      const data = await api('/api/predict', {
        method: 'POST',
        body,
        signal: controller.signal,
      });
      if (id !== requestId.current) return;
      setResult(data);
      setShowHeat(false);
      const thumbnail = await createThumbnail(file);
      const { heatmap, ...summary } = data;
      const entry = {
        ...summary,
        id: crypto.randomUUID(),
        thumbnail,
        fileName: file.name,
      };
      updateNotes((previous) => [entry, ...previous].slice(0, 20));
      setTimeout(
        () =>
          resultRef.current?.scrollIntoView({
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'instant'
              : 'smooth',
            block: 'nearest',
          }),
        100,
      );
    } catch (e) {
      setError(
        e.name === 'AbortError'
          ? 'Analysis timed out. Try a smaller photo or restart the service.'
          : e.message,
      );
    } finally {
      clearTimeout(timer);
      busyRef.current = false;
      setBusy(false);
    }
  }
  function reset() {
    if (busyRef.current) return;
    requestId.current++;
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    setSampleName('');
    setShowHeat(false);
  }
  function exportResult(data = result) {
    const blob = new Blob(
      [JSON.stringify({ ...data, team: TEAM, project: 'LeafLens' }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leaflens-analysis.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function navigate(next) {
    setPage(next);
    setMenu(false);
  }
  const current = experiments[modelIndex] || experiments[0];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('diagnose');
          }}
        >
          <span className="brand-mark">
            <Leaf size={23} />
          </span>
          LeafLens<span className="brand-dot">.</span>
        </a>
        <div className="sidebar-subtitle">The crop health field station</div>
        <nav aria-label="Main navigation">
          {NAV.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`nav-item ${page === id ? 'active' : ''}`}
              aria-current={page === id ? 'page' : undefined}
            >
              <Icon size={19} />
              {label}
              {page === id && <ChevronRight size={16} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="small-leaf">
            <Sprout size={28} />
          </div>
          <p>
            Small observations.
            <br />
            Better growing decisions.
          </p>
          <span>Deep Learning course project</span>
          <div className="sidebar-rule" />
          <button className="about-link" onClick={() => navigate('lab')}>
            <CircleHelp size={16} /> Behind the project
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Toggle navigation"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Field station <ChevronRight size={13} />
            <strong>{NAV.find((n) => n[0] === page)[1]}</strong>
          </div>
          <div className={`connection ${health?.model_ready ? 'ready' : ''}`}>
            <span />
            {offline
              ? 'Service offline'
              : health?.training?.length
                ? 'Training in progress'
                : health?.model_ready
                  ? `${health.architecture === 'vgg16' ? 'VGG16' : 'CNN'} connected`
                  : 'Model awaiting training'}
          </div>
          <button
            className="icon-button"
            onClick={refresh}
            aria-label="Refresh model status"
          >
            <RefreshCw size={16} />
          </button>
        </header>
        <main id="main">
          {page !== 'diagnose' && error && (
            <div className="error-message" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={15} />
              </button>
            </div>
          )}
          {page === 'diagnose' && (
            <>
              <section className="intro">
                <div>
                  <div className="intro-kicker">
                    <span className="tiny-line" /> Grow with a little more
                    clarity
                  </div>
                  <h1>
                    A closer look.
                    <br />A healthier harvest.
                  </h1>
                  <p>
                    Turn a leaf photograph into a clearer picture of crop
                    health.
                    <br className="desktop-break" /> Observe, understand, and
                    know what to check next.
                  </p>
                </div>
                <div className="intro-stamp">
                  <Leaf size={35} strokeWidth={1} />
                  <span>
                    Rooted in research.
                    <br />
                    Built for the field.
                  </span>
                </div>
              </section>
              <section
                className="diagnostic-grid"
                aria-label="Leaf diagnosis workspace"
              >
                <div className="specimen-panel">
                  <div className="panel-top">
                    <span>
                      <ScanLine size={16} /> Leaf specimen
                    </span>
                    <span className="subtle">
                      {file ? 'Ready to inspect' : 'Start with one leaf'}
                    </span>
                  </div>
                  <div
                    className={`specimen ${preview ? 'has-photo' : ''} ${drag ? 'dragging' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDrag(true);
                    }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDrag(false);
                      selectFile(e.dataTransfer.files[0]);
                    }}
                  >
                    {preview ? (
                      <img
                        className="specimen-image"
                        src={preview}
                        alt="Selected crop leaf for analysis"
                      />
                    ) : (
                      <div className="specimen-art">
                        <img
                          src="/botanical.jpg"
                          alt="Green foliage photographed in natural light"
                        />
                        <div className="photo-shade" />
                        <div className="photo-label">
                          <span className="photo-dot" /> A little attention goes
                          a long way.
                        </div>
                      </div>
                    )}
                    {preview && showHeat && result && (
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
                    {busy && (
                      <div className="scanning">
                        <div className="scan-sweep" />
                        <span>
                          <span className="spinner" />
                          Reading leaf patterns…
                        </span>
                      </div>
                    )}
                    {!preview && (
                      <button
                        className="photo-upload"
                        onClick={() => input.current.click()}
                      >
                        <ImagePlus size={18} /> Add your leaf photo
                      </button>
                    )}
                    {preview && (
                      <div className="image-tools">
                        <span>{sampleName || file.name}</span>
                        <button
                          disabled={busy}
                          onClick={() => input.current.click()}
                          aria-label="Replace leaf photo"
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button
                          disabled={busy}
                          onClick={reset}
                          aria-label="Remove leaf photo"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="upload-footer">
                    <div>
                      <strong>One leaf. Natural light. Clear details.</strong>
                      <span>JPEG, PNG or WebP · Up to {uploadLimit} MB</span>
                    </div>
                    <button
                      className="icon-button camera-button"
                      onClick={() => camera.current.click()}
                      disabled={busy}
                      aria-label="Take a leaf photo"
                    >
                      <Camera size={20} />
                    </button>
                  </div>
                  <input
                    ref={input}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="visually-hidden"
                    onChange={(e) => selectFile(e.target.files[0])}
                    aria-label="Upload leaf photo"
                    disabled={busy}
                  />
                  <input
                    ref={camera}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="visually-hidden"
                    onChange={(e) => selectFile(e.target.files[0])}
                    aria-label="Capture leaf photo"
                    disabled={busy}
                  />
                </div>
                <div className="analysis-panel" ref={resultRef}>
                  <div className="panel-top">
                    <span>
                      <Layers size={16} /> The leaf's story
                    </span>
                    <span className="subtle">
                      {result ? 'Analysis complete' : 'Visual analysis'}
                    </span>
                  </div>
                  <label className="model-choice">
                    <span>Analysis model</span>
                    <select
                      aria-label="Analysis model"
                      value={modelChoice}
                      disabled={busy}
                      onChange={(e) => {
                        setModelChoice(e.target.value);
                        setResult(null);
                        setShowHeat(false);
                      }}
                    >
                      <option value="vgg16">VGG16 transfer learning</option>
                      <option value="cnn">Custom CNN baseline</option>
                    </select>
                  </label>
                  {result ? (
                    <div className="results" aria-live="polite">
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
                      <span className="result-crop">
                        {result.predictions[0].crop}
                      </span>
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
                      <div className="alternative-heading">
                        Other possible patterns
                      </div>
                      {result.predictions.slice(1, 4).map((p) => (
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
                      <div className="result-actions">
                        <button
                          className="secondary-button"
                          onClick={() => exportResult()}
                        >
                          <Download size={16} /> Save analysis
                        </button>
                        <button
                          className="text-button"
                          onClick={() =>
                            setSelectedDisease(result.predictions[0])
                          }
                        >
                          What to check <ArrowRight size={15} />
                        </button>
                      </div>
                      <p className="inference-meta">
                        {result.architecture.toUpperCase()} ·{' '}
                        {(result.elapsed_ms / 1000).toFixed(2)} seconds ·
                        Research prediction
                      </p>
                    </div>
                  ) : (
                    <div className="analysis-empty">
                      <div className="empty-icon">
                        <Sprout size={32} strokeWidth={1.4} />
                      </div>
                      <h2>
                        {busy
                          ? 'Looking beneath the surface.'
                          : 'Every leaf tells a story.'}
                      </h2>
                      <p>
                        {busy
                          ? 'The model is comparing visual patterns and creating an attention map.'
                          : 'Add a clear leaf photo to explore possible disease patterns, confidence, and the details that matter.'}
                      </p>
                      <div className="analysis-steps">
                        <div>
                          <Check size={16} />
                          <span>Crop & disease classification</span>
                        </div>
                        <div>
                          <Check size={16} />
                          <span>Confidence & alternative matches</span>
                        </div>
                        <div>
                          <Check size={16} />
                          <span>A visual explanation with Grad-CAM</span>
                        </div>
                      </div>
                      <button
                        className="analyze-button"
                        onClick={file ? analyze : () => input.current.click()}
                        disabled={busy}
                      >
                        <ScanLine size={19} />
                        {busy
                          ? 'Analyzing…'
                          : file
                            ? 'Analyze this leaf'
                            : 'Upload a leaf photo'}
                        {!busy && <ArrowUpRight size={19} />}
                      </button>
                      <span className="local-note">
                        <ShieldCheck size={14} /> Photos are processed locally
                        by this service.
                      </span>
                    </div>
                  )}
                  {error && (
                    <div className="error-message" role="alert">
                      <AlertCircle size={18} />
                      <span>{error}</span>
                      <button
                        aria-label="Dismiss error"
                        onClick={() => setError('')}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </section>
              {samples.length > 0 && (
                <section className="sample-section">
                  <div className="section-caption">
                    <h3>No photo on hand?</h3>
                    <span>Try a real held-out dataset sample.</span>
                  </div>
                  <div className="sample-list">
                    {samples.slice(0, 4).map((sample) => (
                      <button
                        className="sample"
                        key={sample.url}
                        disabled={busy}
                        onClick={() => chooseSample(sample)}
                      >
                        <img src={sample.url} alt="" />
                        <span>
                          <strong>{sample.crop}</strong>
                          <small>{sample.name}</small>
                        </span>
                        <ArrowUpRight size={16} />
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section className="research-strip">
                <div>
                  <FlaskConical size={22} />
                  <span>
                    <strong>More than a prediction</strong>
                    <small>
                      VGG16 transfer learning, a CNN baseline, and transparent
                      evaluation.
                    </small>
                  </span>
                </div>
                <button onClick={() => navigate('lab')}>
                  Explore the model lab <ArrowUpRight size={17} />
                </button>
              </section>
              <div className="responsibility">
                <ShieldCheck size={16} />
                <p>
                  A second pair of eyes, not a final diagnosis. Real field
                  conditions differ from the training dataset. Confirm findings
                  with an agricultural expert before treatment.
                </p>
              </div>
            </>
          )}
          {page === 'atlas' && (
            <>
              <PageIntro
                kicker="Observe before you act"
                title="Know the patterns."
                description="Explore the leaf conditions represented in our PlantVillage dataset. These observations help you ask better questions, not choose a treatment."
              />
              <div className="atlas-toolbar">
                <label className="search">
                  <Search size={18} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search crops or conditions"
                    aria-label="Search disease atlas"
                  />
                </label>
                <div className="crop-tabs">
                  {['All crops', 'Tomato', 'Potato', 'Bell pepper'].map((c) => (
                    <button
                      key={c}
                      className={crop === c ? 'selected' : ''}
                      onClick={() => setCrop(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="atlas-grid">
                {library
                  .filter(
                    (item) =>
                      (crop === 'All crops' || item.crop === crop) &&
                      `${item.crop} ${item.condition}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  )
                  .map((item) => (
                    <button
                      className="disease-card"
                      key={item.id}
                      onClick={() => setSelectedDisease(item)}
                    >
                      <div
                        className={`disease-symbol ${item.healthy ? 'healthy' : ''}`}
                      >
                        <Leaf size={27} strokeWidth={1.4} />
                      </div>
                      <span>{item.crop}</span>
                      <h3>{item.condition}</h3>
                      <p>{item.symptoms}</p>
                      <div>
                        Observation guide <ArrowUpRight size={17} />
                      </div>
                    </button>
                  ))}
              </div>
              {!library.length && (
                <EmptyState
                  icon={BookOpen}
                  title="The atlas is waiting for the service."
                  description="Start the backend, then refresh the model status."
                />
              )}
            </>
          )}
          {page === 'lab' && (
            <>
              <PageIntro
                kicker="Research you can inspect"
                title="Inside the model lab."
                description="One dataset. Two architectures. Measured results, reproducible experiments, and a clear view of what the models can—and cannot—tell us."
              />
              <div className="lab-architecture">
                <div className="lab-architecture-copy">
                  <span className="pill">Transfer learning</span>
                  <h2>
                    A trained eye,
                    <br />
                    adapted to the leaf.
                  </h2>
                  <p>
                    VGG16 brings visual features learned from ImageNet. We first
                    train a compact disease head, then fine-tune its final
                    convolutional block at a lower learning rate.
                  </p>
                  <div className="architecture-flow">
                    {[
                      'Leaf image',
                      'VGG16 backbone',
                      'Global pooling',
                      'Disease scores',
                    ].map((s, i) => (
                      <React.Fragment key={s}>
                        <span>{s}</span>
                        {i < 3 && <ChevronRight size={15} />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div
                  className="layer-art"
                  aria-label="Illustration of stacked convolutional feature layers"
                >
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <span>From pixels to patterns</span>
                </div>
              </div>
              <div className="lab-heading">
                <h3>Experiment results</h3>
                <span>Held-out test data only</span>
              </div>
              {experiments.length ? (
                <>
                  <div className="model-tabs">
                    {experiments.map((e, i) => (
                      <button
                        key={e.architecture}
                        className={i === modelIndex ? 'selected' : ''}
                        onClick={() => setModelIndex(i)}
                      >
                        {e.architecture === 'vgg16'
                          ? 'VGG16 transfer learning'
                          : 'Custom CNN baseline'}
                        {e.subset && <small>Subset run</small>}
                      </button>
                    ))}
                  </div>
                  <div className="metric-grid">
                    {[
                      ['Test accuracy', pct(current.accuracy)],
                      ['Macro F1', pct(current.macro_f1)],
                      ['Test images', current.test_samples],
                      ['Calibration error', pct(current.calibration.ece)],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <span>{l}</span>
                        <strong>{v}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="charts-grid">
                    <div className="chart-panel">
                      <h3>Learning curves</h3>
                      <LearningChart history={current.history} />
                      <div className="chart-legend">
                        <span>Training</span>
                        <span>Validation</span>
                      </div>
                    </div>
                    <div className="chart-panel">
                      <h3>Confusion matrix</h3>
                      <ConfusionMatrix experiment={current} />
                      <small>Rows: true class · Columns: predicted class</small>
                    </div>
                  </div>
                  <details className="experiment-details">
                    <summary>Reproducibility & limitations</summary>
                    <dl>
                      <dt>Dataset</dt>
                      <dd>{current.dataset}</dd>
                      <dt>Split</dt>
                      <dd>{JSON.stringify(current.split_counts)}</dd>
                      <dt>Best epoch / stage</dt>
                      <dd>
                        {current.best_epoch} / {current.best_stage}
                      </dd>
                      <dt>Seed</dt>
                      <dd>{current.seed}</dd>
                      <dt>Image size</dt>
                      <dd>
                        {current.image_size} × {current.image_size}
                      </dd>
                      <dt>Manifest fingerprint</dt>
                      <dd className="fingerprint">{current.manifest_hash}</dd>
                    </dl>
                    {current.subset && (
                      <p>
                        This run uses up to {current.max_per_class} images per
                        class. It is a measured subset experiment, not a
                        full-dataset benchmark.
                      </p>
                    )}
                    <ul>
                      {current.limitations.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  </details>
                  <div className="class-table-wrap">
                    <table className="class-table">
                      <caption>Per-class performance</caption>
                      <thead>
                        <tr>
                          <th>Class</th>
                          <th>Precision</th>
                          <th>Recall</th>
                          <th>F1</th>
                          <th>Support</th>
                        </tr>
                      </thead>
                      <tbody>
                        {current.classes.map((c) => (
                          <tr key={c}>
                            <td>{c.replaceAll('_', ' ')}</td>
                            {['precision', 'recall', 'f1-score'].map((m) => (
                              <td key={m}>
                                {pct(current.classification_report[c][m])}
                              </td>
                            ))}
                            <td>{current.classification_report[c].support}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={FlaskConical}
                  title="Real experiments belong here."
                  description="Run the training pipeline to populate accuracy, F1, learning curves and a confusion matrix. No results are invented."
                />
              )}
              <div className="method-grid">
                {[
                  [
                    'Prepare',
                    'Decoded-pixel duplicate removal, stratified 70/15/15 split, ImageNet normalization.',
                  ],
                  [
                    'Train',
                    'Training-only augmentation, class weights, dropout, staged fine-tuning and early stopping.',
                  ],
                  [
                    'Evaluate',
                    'Untouched test set, macro F1, per-class scores, confusion matrix and confidence calibration audit.',
                  ],
                ].map(([t, d]) => (
                  <div key={t}>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </div>
                ))}
              </div>
              <section className="team-section">
                <h3>The project team</h3>
                <div>
                  {TEAM.map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </div>
                <p>
                  Deep Learning course project · CNN & VGGNet · PlantVillage,
                  Kaggle
                </p>
              </section>
            </>
          )}
          {page === 'history' && (
            <>
              <PageIntro
                kicker="Your local observation log"
                title="Notes from the field."
                description="Recent analyses are saved in this browser only. Keep a record, compare observations, and bring better information to an expert."
              />
              {history.length ? (
                <>
                  <div className="history-toolbar">
                    <span>
                      {history.length} saved{' '}
                      {history.length === 1 ? 'observation' : 'observations'}
                    </span>
                    <button
                      className="text-button"
                      onClick={() => {
                        updateNotes(() => []);
                      }}
                    >
                      <Trash2 size={16} /> Clear field notes
                    </button>
                  </div>
                  <div className="history-list">
                    {history.map((entry) => (
                      <article className="history-card" key={entry.id}>
                        <img
                          src={entry.thumbnail}
                          alt="Previously analyzed leaf"
                        />
                        <div>
                          <span>
                            {entry.predictions[0].crop} ·{' '}
                            {new Date(entry.created_at).toLocaleDateString()}
                          </span>
                          <h3>{entry.predictions[0].condition}</h3>
                          <p>
                            {entry.fileName} ·{' '}
                            {entry.architecture.toUpperCase()}
                          </p>
                        </div>
                        <div className="history-confidence">
                          <strong>{pct(entry.confidence)}</strong>
                          <span>Model score</span>
                        </div>
                        <button
                          className="icon-button"
                          aria-label="Download saved analysis"
                          onClick={() => exportResult(entry)}
                        >
                          <Download size={19} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Delete saved analysis"
                          onClick={() =>
                            updateNotes((previous) =>
                              previous.filter((r) => r.id !== entry.id),
                            )
                          }
                        >
                          <Trash2 size={18} />
                        </button>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={History}
                  title="Your first observation starts with a leaf."
                  description="Analyze a photograph and its result will appear here. Up to 20 observations are kept on this device."
                  action={
                    <button
                      className="secondary-button"
                      onClick={() => navigate('diagnose')}
                    >
                      Analyze a leaf <ArrowRight size={16} />
                    </button>
                  }
                />
              )}
            </>
          )}
        </main>
        <footer className="footer">
          <span>
            <Leaf size={14} /> LeafLens
            <a
              className="sources-link"
              href="/sources.txt"
              target="_blank"
              rel="noreferrer"
            >
              Sources
            </a>
          </span>
          <span>Better observations. Thoughtful decisions.</span>
          <span>Course project · 2026</span>
        </footer>
      </div>
      {selectedDisease && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedDisease(null)}
        >
          <DiseaseModal
            item={selectedDisease}
            onClose={() => setSelectedDisease(null)}
          />
        </div>
      )}
    </div>
  );
}
function PageIntro({ kicker, title, description }) {
  return (
    <section className="page-intro">
      <div className="intro-kicker">
        <span className="tiny-line" />
        {kicker}
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}
function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      <Icon size={37} strokeWidth={1.3} />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
function LearningChart({ history }) {
  const width = 500,
    height = 200,
    pad = 30;
  const points = (key) =>
    history
      .map(
        (r, i) =>
          `${pad + (i * (width - 2 * pad)) / Math.max(history.length - 1, 1)},${height - pad - r[key] * (height - 2 * pad)}`,
      )
      .join(' ');
  return (
    <svg
      className="learning-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Training and validation accuracy by epoch"
    >
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line
            x1={pad}
            x2={width - pad}
            y1={height - pad - v * (height - 2 * pad)}
            y2={height - pad - v * (height - 2 * pad)}
            stroke="#e6eae3"
          />
          <text x="4" y={height - pad - v * (height - 2 * pad) + 4}>
            {v * 100}%
          </text>
        </g>
      ))}
      <polyline
        points={points('train_accuracy')}
        fill="none"
        stroke="#1b6240"
        strokeWidth="3"
      />
      <polyline
        points={points('val_accuracy')}
        fill="none"
        stroke="#9ab66a"
        strokeWidth="3"
      />
      {history.map((r, i) => (
        <text
          key={i}
          x={pad + (i * (width - 2 * pad)) / Math.max(history.length - 1, 1)}
          y={height - 6}
        >
          {r.epoch}
        </text>
      ))}
    </svg>
  );
}
function ConfusionMatrix({ experiment }) {
  const max = Math.max(1, ...experiment.confusion_matrix.flat());
  return (
    <div
      className="matrix"
      style={{
        gridTemplateColumns: `repeat(${experiment.classes.length},1fr)`,
      }}
      role="img"
      aria-label="Confusion matrix; hover cells to inspect class counts"
    >
      {experiment.confusion_matrix.flatMap((row, i) =>
        row.map((n, j) => (
          <div
            key={`${i}-${j}`}
            title={`${experiment.classes[i]} → ${experiment.classes[j]}: ${n}`}
            style={{
              background: `rgba(27,98,64,${0.05 + (0.95 * n) / max})`,
              color: n / max > 0.5 ? 'white' : '#37523e',
            }}
          >
            {experiment.classes.length <= 16 ? n : ''}
          </div>
        )),
      )}
    </div>
  );
}
function DiseaseModal({ item, onClose }) {
  const dialog = useRef(),
    close = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    function key(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const elements = dialog.current.querySelectorAll('button,a,input');
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, []);
  return (
    <section
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="disease-title"
      className="disease-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={close}
        className="modal-close icon-button"
        aria-label="Close observation guide"
        onClick={onClose}
      >
        <X />
      </button>
      <span className="pill">{item.crop}</span>
      <h2 id="disease-title">{item.condition}</h2>
      <p>{item.symptoms}</p>
      <h3>What to check next</h3>
      <ul>
        {item.guidance.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
      <div className="modal-notice">
        <ShieldCheck size={20} />
        <p>
          Similar symptoms can have different causes. This guide offers
          observations, not treatment instructions.
        </p>
      </div>
    </section>
  );
}
async function createThumbnail(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = 180;
  const context = canvas.getContext('2d');
  const size = Math.min(bitmap.width, bitmap.height);
  context.drawImage(
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
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.65);
}
export default App;
