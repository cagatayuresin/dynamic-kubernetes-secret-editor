import githubDark from 'highlight.js/styles/github-dark.css?url';
import githubLight from 'highlight.js/styles/github.css?url';
import hljs from 'highlight.js/lib/core';
import yaml from 'highlight.js/lib/languages/yaml';
import packageJson from '../../package.json';
import exampleYaml from '../../test-secret.yaml?raw';
import {
  addField,
  parseSecret,
  removeField,
  renameField,
  toYaml,
  typeOptions,
  updateFieldValue,
  updateMetadata,
  downloadFilename,
  type SecretModel,
} from '../lib/secret';

hljs.registerLanguage('yaml', yaml);

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type Theme = 'light' | 'dark';

const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3.5a8.5 8.5 0 1 0 5.5 13.5A7 7 0 0 1 15 3.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const SEAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.6 13.2 20 4M16.2 6.4l2.2 2.2M14 8.6l2.2 2.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export function mountApp(root: HTMLElement, storage: KeyValueStore = localStorage): void {
  removeItem(storage, 'yamlContent');
  removeItem(storage, 'secretObject');

  root.innerHTML = template();

  const themeButton = button(root, 'theme-toggle');
  const dropzone = element(root, 'dropzone');
  const fileInput = input(root, 'file-input');
  const yamlInput = textarea(root, 'yaml-input');
  const processButton = button(root, 'process-btn');
  const clearButton = button(root, 'clear-btn');
  const exampleButton = button(root, 'example-btn');
  const formError = paragraph(root, 'form-error');
  const emptyState = element(root, 'empty-state');
  const secretEditor = element(root, 'secret-editor');
  const nameInput = input(root, 'name-input');
  const namespaceInput = input(root, 'namespace-input');
  const typeInput = select(root, 'type-input');
  const editorError = paragraph(root, 'editor-error');
  const warnings = element(root, 'warnings');
  const fields = element(root, 'fields');
  const addForm = form(root, 'add-form');
  const newKey = input(root, 'new-key');
  const addError = paragraph(root, 'add-error');
  const resetButton = button(root, 'reset-btn');
  const previewEmpty = paragraph(root, 'preview-empty');
  const previewPre = element(root, 'preview-pre');
  const preview = code(root, 'preview');
  const copyButton = button(root, 'copy-btn');
  const downloadButton = button(root, 'download-btn');
  const toasts = element(root, 'toasts');
  const version = element(root, 'version');
  version.textContent = packageJson.version;

  const themeLink = document.createElement('link');
  themeLink.id = 'hljs-theme';
  themeLink.rel = 'stylesheet';
  document.getElementById('hljs-theme')?.remove();
  document.head.append(themeLink);

  let model: SecretModel | null = null;
  let dragDepth = 0;
  let resetArmed = false;

  const saved = readItem(storage, 'theme');
  setTheme(saved === 'light' || saved === 'dark' ? saved : preferredTheme());

  themeButton.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });

  processButton.addEventListener('click', () => processText());
  clearButton.addEventListener('click', () => {
    yamlInput.value = '';
    formError.textContent = '';
  });
  exampleButton.addEventListener('click', () => {
    yamlInput.value = exampleYaml.trim();
    processText();
  });

  yamlInput.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      processText();
    }
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }
    void importFile(file);
    fileInput.value = '';
  });

  dropzone.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragDepth += 1;
    dropzone.classList.add('is-hot');
  });
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
  });
  dropzone.addEventListener('dragleave', () => {
    dragDepth -= 1;
    if (dragDepth <= 0) {
      dragDepth = 0;
      dropzone.classList.remove('is-hot');
    }
  });
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    dropzone.classList.remove('is-hot');
    const file = event.dataTransfer?.files[0];
    if (file) {
      void importFile(file);
    }
  });

  nameInput.addEventListener('change', () => {
    if (!model) {
      return;
    }
    try {
      model = updateMetadata(model, { name: nameInput.value });
      editorError.textContent = '';
      paint();
    } catch (error) {
      nameInput.value = model.name;
      editorError.textContent = messageFrom(error);
    }
  });

  namespaceInput.addEventListener('change', () => {
    if (!model) {
      return;
    }
    try {
      model = updateMetadata(model, { namespace: namespaceInput.value });
      editorError.textContent = '';
      paint();
    } catch (error) {
      namespaceInput.value = model.namespace;
      editorError.textContent = messageFrom(error);
    }
  });

  typeInput.addEventListener('change', () => {
    if (!model) {
      return;
    }
    try {
      model = updateMetadata(model, { type: typeInput.value });
      editorError.textContent = '';
      renderWarnings();
      paint();
    } catch (error) {
      typeInput.value = model.type;
      editorError.textContent = messageFrom(error);
    }
  });

  addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!model) {
      return;
    }
    try {
      model = addField(model, newKey.value);
      newKey.value = '';
      addError.textContent = '';
      renderFields();
      renderWarnings();
      paint();
      const last = fields.querySelector('.field-card:last-child textarea');
      if (last instanceof HTMLTextAreaElement) {
        last.focus();
      }
    } catch (error) {
      addError.textContent = messageFrom(error);
    }
  });

  resetButton.addEventListener('click', () => {
    if (!resetArmed) {
      resetArmed = true;
      resetButton.textContent = 'Confirm reset';
      return;
    }
    resetArmed = false;
    resetButton.textContent = 'Reset';
    model = null;
    emptyState.hidden = false;
    secretEditor.hidden = true;
    fields.replaceChildren();
    editorError.textContent = '';
    addError.textContent = '';
    renderWarnings();
    paint();
    toast('Editor cleared');
  });

  copyButton.addEventListener('click', () => {
    void copyYaml();
  });
  downloadButton.addEventListener('click', () => downloadYaml());

  function setTheme(theme: Theme): void {
    document.documentElement.dataset.theme = theme;
    writeItem(storage, 'theme', theme);
    themeLink.href = theme === 'dark' ? githubDark : githubLight;
    themeButton.innerHTML = theme === 'dark' ? SUN : MOON;
    themeButton.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    themeButton.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  function processText(): void {
    const text = yamlInput.value.trim();
    if (!text) {
      formError.textContent = 'Paste a Secret YAML or choose a file.';
      return;
    }
    try {
      model = parseSecret(text);
      formError.textContent = '';
      editorError.textContent = '';
      addError.textContent = '';
      yamlInput.value = '';
      resetArmed = false;
      resetButton.textContent = 'Reset';
      showEditor();
      toast(`Loaded ${model.name}`, 'success');
    } catch (error) {
      formError.textContent = messageFrom(error);
    }
  }

  async function importFile(file: File): Promise<void> {
    try {
      yamlInput.value = await file.text();
      processText();
    } catch (error) {
      formError.textContent = messageFrom(error);
    }
  }

  function showEditor(): void {
    if (!model) {
      return;
    }
    emptyState.hidden = true;
    secretEditor.hidden = false;
    nameInput.value = model.name;
    namespaceInput.value = model.namespace;
    fillTypes(typeInput, model.type);
    renderFields();
    renderWarnings();
    paint();
  }

  function renderWarnings(): void {
    warnings.replaceChildren();
    for (const warning of model?.warnings ?? []) {
      const item = document.createElement('p');
      item.className = 'hint';
      item.textContent = warning;
      warnings.append(item);
    }
  }

  function renderFields(): void {
    fields.replaceChildren();
    if (!model) {
      return;
    }
    for (const field of model.fields) {
      fields.append(renderField(field.key, field.kind, field.value));
    }
  }

  function renderField(key: string, kind: SecretModel['fields'][number]['kind'], value: string): HTMLElement {
    const card = document.createElement('article');
    card.className = 'field-card';
    card.dataset.key = key;

    const head = document.createElement('div');
    head.className = 'field-head';

    const keyLabel = document.createElement('label');
    keyLabel.className = 'key-label';
    const keyCaption = document.createElement('span');
    keyCaption.className = 'sr-only';
    keyCaption.textContent = 'Key';
    const keyInput = document.createElement('input');
    keyInput.className = 'key-input';
    keyInput.value = key;
    keyInput.spellcheck = false;
    keyInput.autocomplete = 'off';
    keyInput.setAttribute('aria-label', `Key ${key}`);
    keyLabel.append(keyCaption, keyInput);

    const actions = document.createElement('div');
    actions.className = 'field-actions';
    if (kind === 'binary') {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'Binary';
      actions.append(badge);
    }

    const visibility = document.createElement('button');
    visibility.type = 'button';
    visibility.className = 'button ghost';
    visibility.textContent = 'Show';
    visibility.setAttribute('aria-pressed', 'false');
    visibility.setAttribute('aria-label', `Show ${key}`);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button ghost danger';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete ${key}`);
    actions.append(visibility, remove);
    head.append(keyLabel, actions);

    const valueLabel = document.createElement('label');
    valueLabel.className = 'value-label';
    const valueCaption = document.createElement('span');
    valueCaption.className = 'sr-only';
    valueCaption.textContent = `Value for ${key}`;
    const valueInput = document.createElement('textarea');
    valueInput.className = 'value is-masked';
    valueInput.value = value;
    valueInput.spellcheck = false;
    valueInput.autocomplete = 'off';
    valueInput.rows = 3;
    if (kind === 'binary') {
      valueInput.readOnly = true;
    }
    valueLabel.append(valueCaption, valueInput);
    card.append(head, valueLabel);

    visibility.addEventListener('click', () => {
      const masked = valueInput.classList.toggle('is-masked');
      visibility.textContent = masked ? 'Show' : 'Hide';
      visibility.setAttribute('aria-pressed', masked ? 'false' : 'true');
      visibility.setAttribute('aria-label', `${masked ? 'Show' : 'Hide'} ${keyInput.value || key}`);
    });

    remove.addEventListener('click', () => {
      if (!model) {
        return;
      }
      model = removeField(model, key);
      renderFields();
      renderWarnings();
      paint();
      toast(`Removed ${key}`);
    });

    keyInput.addEventListener('blur', () => {
      if (!model || keyInput.value === key) {
        return;
      }
      try {
        model = renameField(model, key, keyInput.value);
        editorError.textContent = '';
        renderFields();
        renderWarnings();
        paint();
      } catch (error) {
        keyInput.value = key;
        editorError.textContent = messageFrom(error);
      }
    });

    if (kind === 'text') {
      valueInput.addEventListener('input', () => {
        if (!model) {
          return;
        }
        model = updateFieldValue(model, key, valueInput.value);
        autosize(valueInput);
        paint();
      });
    }

    autosize(valueInput);
    return card;
  }

  function paint(): void {
    const codeText = model ? toYaml(model) : '';
    if (!codeText) {
      previewEmpty.hidden = false;
      previewPre.hidden = true;
      preview.textContent = '';
      return;
    }
    previewEmpty.hidden = true;
    previewPre.hidden = false;
    preview.innerHTML = hljs.highlight(codeText, { language: 'yaml' }).value;
  }

  async function copyYaml(): Promise<void> {
    if (!model) {
      toast('Nothing to copy', 'warn');
      return;
    }
    try {
      await navigator.clipboard.writeText(toYaml(model));
      toast('Copied YAML', 'success');
    } catch {
      toast('Could not copy YAML', 'warn');
    }
  }

  function downloadYaml(): void {
    if (!model) {
      toast('Nothing to download', 'warn');
      return;
    }
    const filename = downloadFilename(model.name);
    const blob = new Blob([toYaml(model)], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast(`Downloaded ${filename}`, 'success');
  }

  function toast(message: string, tone: 'info' | 'success' | 'warn' = 'info'): void {
    toasts.replaceChildren();
    const item = document.createElement('div');
    item.className = `toast toast-${tone}`;
    item.setAttribute('role', 'status');
    const text = document.createElement('span');
    text.textContent = message;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.textContent = 'Close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.addEventListener('click', () => item.remove());
    item.append(text, close);
    toasts.append(item);
    window.setTimeout(() => item.remove(), 3200);
  }
}

function preferredTheme(): Theme {
  if (typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readItem(storage: KeyValueStore, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(storage: KeyValueStore, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Private mode and blocked storage still leave the editor usable.
  }
}

function removeItem(storage: KeyValueStore, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage failures while clearing legacy secret copies.
  }
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function autosize(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.max(textarea.scrollHeight, 88)}px`;
}

function fillTypes(select: HTMLSelectElement, type: string): void {
  select.replaceChildren();
  for (const item of typeOptions(type)) {
    const option = document.createElement('option');
    option.value = item;
    option.textContent = item;
    select.append(option);
  }
  select.value = type;
}

function template(): string {
  return `
    <a class="skip" href="#import-panel">Skip to editor</a>
    <div class="wrap">
      <header class="topbar">
        <div class="brand">
          <span class="seal">${SEAL}</span>
          <div>
            <p class="eyebrow">Kubernetes</p>
            <h1>Secret Editor</h1>
            <p class="lede">Secrets stay in this tab. Nothing is uploaded or saved.</p>
          </div>
        </div>
        <button id="theme-toggle" class="icon-button" type="button" aria-label="Switch to dark theme"></button>
      </header>
      <main class="layout">
        <div class="editor-column">
          <section id="import-panel" class="panel">
            <h2>Import</h2>
            <div id="dropzone" class="dropzone">
              <p>Drop a Secret YAML here</p>
              <label class="button ghost file-button">
                Choose file
                <input id="file-input" type="file" accept=".yaml,.yml,text/yaml,application/yaml">
              </label>
            </div>
            <label class="stack-label" for="yaml-input">YAML draft</label>
            <textarea id="yaml-input" spellcheck="false" autocomplete="off" autocapitalize="off" rows="8" aria-describedby="shortcut-hint" placeholder="apiVersion: v1&#10;kind: Secret&#10;metadata:&#10;  name: my-secret&#10;type: Opaque&#10;stringData:&#10;  username: ada"></textarea>
            <p id="shortcut-hint" class="quiet">Ctrl+Enter or Cmd+Enter processes the draft.</p>
            <div class="actions">
              <button id="process-btn" class="button primary" type="button">Process YAML</button>
              <button id="example-btn" class="button ghost" type="button">Load example</button>
              <button id="clear-btn" class="button ghost" type="button">Clear draft</button>
            </div>
            <p id="form-error" class="error" role="alert"></p>
          </section>
          <section id="empty-state" class="panel">
            <h2>Editor</h2>
            <p class="quiet">Decoded keys will show up here. Binary values stay encoded.</p>
          </section>
          <section id="secret-editor" class="panel" hidden>
            <div class="panel-head">
              <h2>Keys</h2>
              <button id="reset-btn" class="button ghost danger" type="button">Reset</button>
            </div>
            <div class="meta">
              <label>Name <input id="name-input" autocomplete="off" spellcheck="false"></label>
              <label>Namespace <input id="namespace-input" autocomplete="off" spellcheck="false" placeholder="optional"></label>
              <label class="wide">Type <select id="type-input"></select></label>
            </div>
            <p id="editor-error" class="error" role="alert"></p>
            <div id="warnings"></div>
            <div id="fields"></div>
            <form id="add-form" class="add-form">
              <label>New key <input id="new-key" autocomplete="off" spellcheck="false" placeholder="api-token"></label>
              <button class="button primary" type="submit">Add key</button>
              <p id="add-error" class="error" role="alert"></p>
            </form>
          </section>
        </div>
        <section class="panel preview-panel">
          <div class="panel-head">
            <h2>Preview</h2>
            <div class="actions">
              <button id="copy-btn" class="button ghost" type="button">Copy</button>
              <button id="download-btn" class="button primary" type="button">Download</button>
            </div>
          </div>
          <p id="preview-empty" class="placeholder">Processed YAML will appear here.</p>
          <pre id="preview-pre" hidden><code id="preview" class="hljs language-yaml"></code></pre>
        </section>
      </main>
      <footer class="footer">
        <p><strong>Dynamic Kubernetes Secret Editor</strong> · Version <span id="version"></span></p>
        <p>by <a href="https://cagatayuresin.com">Cagatay URESIN</a></p>
        <p class="footer-links">
          <a href="https://github.com/cagatayuresin" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://www.linkedin.com/in/cagatayuresin/" target="_blank" rel="noreferrer">LinkedIn</a>
          <a href="https://github.com/cagatayuresin/dynamic-kubernetes-secret-editor/blob/main/CHANGELOG.md" target="_blank" rel="noreferrer">Changelog</a>
          <a href="https://github.com/cagatayuresin/dynamic-kubernetes-secret-editor/blob/main/SECURITY.md" target="_blank" rel="noreferrer">Security</a>
          <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noreferrer">MIT</a>
        </p>
      </footer>
    </div>
    <div id="toasts" class="toasts" aria-live="polite"></div>
  `;
}

function element(root: HTMLElement, id: string): HTMLElement {
  const node = root.querySelector(`#${id}`);
  if (!(node instanceof HTMLElement)) {
    throw new TypeError(`Missing #${id}`);
  }
  return node;
}

function input(root: HTMLElement, id: string): HTMLInputElement {
  const node = element(root, id);
  if (!(node instanceof HTMLInputElement)) {
    throw new TypeError(`Missing input #${id}`);
  }
  return node;
}

function textarea(root: HTMLElement, id: string): HTMLTextAreaElement {
  const node = element(root, id);
  if (!(node instanceof HTMLTextAreaElement)) {
    throw new TypeError(`Missing textarea #${id}`);
  }
  return node;
}

function button(root: HTMLElement, id: string): HTMLButtonElement {
  const node = element(root, id);
  if (!(node instanceof HTMLButtonElement)) {
    throw new TypeError(`Missing button #${id}`);
  }
  return node;
}

function select(root: HTMLElement, id: string): HTMLSelectElement {
  const node = element(root, id);
  if (!(node instanceof HTMLSelectElement)) {
    throw new TypeError(`Missing select #${id}`);
  }
  return node;
}

function form(root: HTMLElement, id: string): HTMLFormElement {
  const node = element(root, id);
  if (!(node instanceof HTMLFormElement)) {
    throw new TypeError(`Missing form #${id}`);
  }
  return node;
}

function paragraph(root: HTMLElement, id: string): HTMLParagraphElement {
  const node = element(root, id);
  if (!(node instanceof HTMLParagraphElement)) {
    throw new TypeError(`Missing paragraph #${id}`);
  }
  return node;
}

function code(root: HTMLElement, id: string): HTMLElement {
  const node = element(root, id);
  if (!(node instanceof HTMLElement)) {
    throw new TypeError(`Missing code #${id}`);
  }
  return node;
}
