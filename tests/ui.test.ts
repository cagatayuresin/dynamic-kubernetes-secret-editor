import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountApp, type KeyValueStore } from '../src/ui/app';
import { parseSecret } from '../src/lib/secret';

const writeText = vi.fn().mockResolvedValue(undefined);
const originalMatchMedia = window.matchMedia.bind(window);

function root(): HTMLElement {
  const node = document.querySelector('#app');
  if (!(node instanceof HTMLElement)) {
    throw new Error('missing app');
  }
  return node;
}

function setup(storage?: KeyValueStore): HTMLElement {
  mountApp(root(), storage);
  return root();
}

function field(key: string): HTMLTextAreaElement {
  const node = document.querySelector(`[data-key="${key}"] textarea`);
  if (!(node instanceof HTMLTextAreaElement)) {
    throw new Error(`missing field ${key}`);
  }
  return node;
}

function dropEvent(transfer: DataTransfer): Event {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: transfer });
  return event;
}

function inputValue(id: string): string {
  const node = document.querySelector(`#${id}`);
  if (!(node instanceof HTMLInputElement) && !(node instanceof HTMLTextAreaElement) && !(node instanceof HTMLSelectElement)) {
    throw new Error(id);
  }
  return node.value;
}

const demoYaml = `apiVersion: v1
kind: Secret
metadata:
  name: demo
type: Opaque
stringData:
  username: ada
  note: "line1\\nline2"
`;

describe('editor ui', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    document.getElementById('hljs-theme')?.remove();
    localStorage.clear();
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
  });

  it('shows the version and an empty preview', () => {
    setup();
    expect(document.querySelector('#version')?.textContent).toBe('1.0.0');
    expect(document.querySelector('h1')?.textContent).toBe('Secret Editor');
    expect(document.querySelector('#preview-empty')?.textContent).toMatch(/appear here/);
    expect(document.querySelector('#secret-editor')?.hasAttribute('hidden')).toBe(true);
  });

  it('decodes a pasted secret, edits multiline text, and exports canonical data', () => {
    setup();
    const draft = document.querySelector('#yaml-input') as HTMLTextAreaElement;
    draft.value = demoYaml;
    document.querySelector<HTMLButtonElement>('#process-btn')?.click();

    expect(draft.value).toBe('');
    expect(inputValue('name-input')).toBe('demo');
    expect(field('username').value).toBe('ada');
    expect(field('note').value).toBe('line1\nline2');
    expect(field('username').classList.contains('is-masked')).toBe(true);

    field('username').value = 'grace';
    field('username').dispatchEvent(new Event('input'));
    const show = document.querySelector('[aria-label="Show username"]') as HTMLButtonElement;
    show.click();
    expect(field('username').classList.contains('is-masked')).toBe(false);
    expect(show.textContent).toBe('Hide');
    show.click();
    expect(show.textContent).toBe('Show');

    const preview = document.querySelector('#preview')?.textContent ?? '';
    expect(preview).not.toContain('stringData');
    expect(parseSecret(preview).fields.find((item) => item.key === 'username')).toMatchObject({ value: 'grace' });
    expect(parseSecret(preview).fields.find((item) => item.key === 'note')).toMatchObject({ value: 'line1\nline2' });
  });

  it('loads the example, adds, renames, and deletes keys', () => {
    setup();
    document.querySelector<HTMLButtonElement>('#example-btn')?.click();
    expect(inputValue('name-input')).toBe('test-secret');
    expect(field('greeting').value).toBe('merhaba dünya');
    expect(field('username').value).toBe('test-user');
    expect(field('password').value).toBe('super-secret-123');
    expect(document.querySelector('#preview')?.textContent).not.toContain('stringData');

    const add = document.querySelector('#add-form') as HTMLFormElement;
    const newKey = document.querySelector('#new-key') as HTMLInputElement;
    newKey.value = ' api-token ';
    add.requestSubmit();
    expect(field('api-token').value).toBe('');

    newKey.value = 'bad key';
    add.requestSubmit();
    expect(document.querySelector('#add-error')?.textContent).toMatch(/Key must contain/);

    newKey.value = 'api-token';
    add.requestSubmit();
    expect(document.querySelector('#add-error')?.textContent).toMatch(/already exists/);

    const keyInput = document.querySelector('[data-key="api-token"] .key-input') as HTMLInputElement;
    keyInput.value = 'api-token';
    keyInput.dispatchEvent(new FocusEvent('blur'));
    expect(document.querySelector('[data-key="api-token"]')).not.toBeNull();

    keyInput.value = 'bad key';
    keyInput.dispatchEvent(new FocusEvent('blur'));
    expect(keyInput.value).toBe('api-token');
    expect(document.querySelector('#editor-error')?.textContent).toMatch(/Key must contain/);

    keyInput.value = 'api_token';
    keyInput.dispatchEvent(new FocusEvent('blur'));
    expect(document.querySelector('[data-key="api_token"]')).not.toBeNull();

    document.querySelector<HTMLButtonElement>('[aria-label="Delete api_token"]')?.click();
    expect(document.querySelector('[data-key="api_token"]')).toBeNull();
  });

  it('keeps binary values read-only and warns for tls keys', () => {
    setup();
    const draft = document.querySelector('#yaml-input') as HTMLTextAreaElement;
    draft.value = `apiVersion: v1
kind: Secret
metadata:
  name: blob
type: kubernetes.io/tls
data:
  blob: "/w=="
`;
    document.querySelector<HTMLButtonElement>('#process-btn')?.click();
    expect(document.querySelector('.badge')?.textContent).toBe('Binary');
    expect(field('blob').readOnly).toBe(true);
    expect(document.querySelector('#warnings')?.textContent).toContain('tls.crt');

    const type = document.querySelector('#type-input') as HTMLSelectElement;
    type.value = 'Opaque';
    type.dispatchEvent(new Event('change'));
    expect(document.querySelector('#warnings')?.textContent).toBe('');

    const option = document.createElement('option');
    option.value = 'bad type';
    option.textContent = 'bad type';
    type.append(option);
    type.value = 'bad type';
    type.dispatchEvent(new Event('change'));
    expect(document.querySelector('#editor-error')?.textContent).toMatch(/unsupported characters/);
    expect(type.value).toBe('Opaque');
  });

  it('updates name and namespace, and restores invalid edits', () => {
    setup();
    const draft = document.querySelector('#yaml-input') as HTMLTextAreaElement;
    draft.value = `apiVersion: v1
kind: Secret
metadata:
  name: demo
type: company.com/special
stringData:
  city: İstanbul
`;
    document.querySelector<HTMLButtonElement>('#process-btn')?.click();
    const type = document.querySelector('#type-input') as HTMLSelectElement;
    expect(type.value).toBe('company.com/special');
    expect([...type.options].some((option) => option.value === 'company.com/special')).toBe(true);

    const name = document.querySelector('#name-input') as HTMLInputElement;
    name.value = 'renamed';
    name.dispatchEvent(new Event('change'));
    expect(document.querySelector('#preview')?.textContent).toContain('name: renamed');

    name.value = 'Nope';
    name.dispatchEvent(new Event('change'));
    expect(name.value).toBe('renamed');
    expect(document.querySelector('#editor-error')?.textContent).toMatch(/DNS subdomain/);

    const namespace = document.querySelector('#namespace-input') as HTMLInputElement;
    namespace.value = 'kube-system';
    namespace.dispatchEvent(new Event('change'));
    expect(document.querySelector('#preview')?.textContent).toContain('namespace: kube-system');
    namespace.value = '';
    namespace.dispatchEvent(new Event('change'));
    expect(document.querySelector('#preview')?.textContent).not.toContain('namespace:');
    namespace.value = 'Prod';
    namespace.dispatchEvent(new Event('change'));
    expect(namespace.value).toBe('');
    expect(document.querySelector('#editor-error')?.textContent).toMatch(/DNS label/);
  });

  it('reports empty and invalid drafts, and clears the draft box', () => {
    setup();
    const draft = document.querySelector('#yaml-input') as HTMLTextAreaElement;
    document.querySelector<HTMLButtonElement>('#process-btn')?.click();
    expect(document.querySelector('#form-error')?.textContent).toMatch(/Paste a Secret/);

    draft.value = 'kind: ConfigMap';
    draft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.querySelector('#secret-editor')?.hasAttribute('hidden')).toBe(true);

    draft.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    expect(document.querySelector('#secret-editor')?.hasAttribute('hidden')).toBe(true);

    draft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, cancelable: true, bubbles: true }));
    expect(document.querySelector('#form-error')?.textContent).toMatch(/Secret/);

    draft.value = demoYaml;
    draft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, cancelable: true, bubbles: true }));
    expect(inputValue('name-input')).toBe('demo');

    draft.value = 'leftover';
    document.querySelector<HTMLButtonElement>('#clear-btn')?.click();
    expect(draft.value).toBe('');
  });

  it('copies and downloads the yaml, and resets after confirmation', async () => {
    setup();
    document.querySelector<HTMLButtonElement>('#copy-btn')?.click();
    expect(document.querySelector('.toast')?.textContent).toContain('Nothing to copy');
    document.querySelector<HTMLButtonElement>('#download-btn')?.click();
    expect(document.querySelector('.toast')?.textContent).toContain('Nothing to download');

    const draft = document.querySelector('#yaml-input') as HTMLTextAreaElement;
    draft.value = demoYaml;
    document.querySelector<HTMLButtonElement>('#process-btn')?.click();

    document.querySelector<HTMLButtonElement>('#copy-btn')?.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(String(writeText.mock.calls[0][0])).toContain('kind: Secret');
    await vi.waitFor(() => expect(document.querySelector('.toast')?.textContent).toContain('Copied YAML'));

    writeText.mockRejectedValueOnce(new Error('denied'));
    document.querySelector<HTMLButtonElement>('#copy-btn')?.click();
    await vi.waitFor(() => expect(document.querySelector('.toast')?.textContent).toContain('Could not copy'));

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:secret');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    let download = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      download = this.download;
    });
    document.querySelector<HTMLButtonElement>('#download-btn')?.click();
    expect(download).toMatch(/^demo-\d{4}-\d{2}-\d{2}\.yaml$/);

    const reset = document.querySelector('#reset-btn') as HTMLButtonElement;
    reset.click();
    expect(reset.textContent).toBe('Confirm reset');
    expect(document.querySelector('#secret-editor')?.hasAttribute('hidden')).toBe(false);
    reset.click();
    expect(document.querySelector('#secret-editor')?.hasAttribute('hidden')).toBe(true);
    expect(document.querySelector('#preview-empty')?.hasAttribute('hidden')).not.toBe(true);
  });

  it('dismisses a toast from its button and on a timer', () => {
    vi.useFakeTimers();
    setup();
    document.querySelector<HTMLButtonElement>('#copy-btn')?.click();
    document.querySelector<HTMLButtonElement>('.toast-close')?.click();
    expect(document.querySelector('.toast')).toBeNull();
    document.querySelector<HTMLButtonElement>('#copy-btn')?.click();
    vi.advanceTimersByTime(3200);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('imports a dropped or chosen file and ignores an empty drop', async () => {
    setup();
    const dropzone = document.querySelector('#dropzone') as HTMLElement;
    dropzone.dispatchEvent(new DragEvent('dragenter', { cancelable: true }));
    dropzone.dispatchEvent(new DragEvent('dragenter', { cancelable: true }));
    dropzone.dispatchEvent(new DragEvent('dragleave'));
    expect(dropzone.classList.contains('is-hot')).toBe(true);
    const over = new DragEvent('dragover', { cancelable: true });
    dropzone.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    dropzone.dispatchEvent(new DragEvent('dragleave'));
    expect(dropzone.classList.contains('is-hot')).toBe(false);

    dropzone.dispatchEvent(new DragEvent('drop', { cancelable: true, dataTransfer: new DataTransfer() }));
    expect(dropzone.classList.contains('is-hot')).toBe(false);

    const file = new File([demoYaml], 'secret.yaml', { type: 'application/yaml' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    dropzone.dispatchEvent(dropEvent(transfer));
    await vi.waitFor(() => expect(inputValue('name-input')).toBe('demo'));

    const chosen = document.querySelector('#file-input') as HTMLInputElement;
    chosen.dispatchEvent(new Event('change'));
    const another = new DataTransfer();
    another.items.add(new File(['kind: Secret\napiVersion: v1\nmetadata:\n  name: from-file\nstringData:\n  a: b\n'], 'a.yaml'));
    chosen.files = another.files;
    chosen.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(inputValue('name-input')).toBe('from-file'));
  });

  it('surfaces a file that cannot be read', async () => {
    setup();
    const original = File.prototype.text;
    File.prototype.text = () => Promise.reject(new Error('unreadable'));
    try {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['nope'], 'bad.yaml'));
      document.querySelector('#dropzone')?.dispatchEvent(dropEvent(transfer));
      await vi.waitFor(() => expect(document.querySelector('#form-error')?.textContent).toContain('unreadable'));
    } finally {
      File.prototype.text = original;
    }
  });

  it('remembers only the theme and clears legacy secret storage', () => {
    const map = new Map<string, string>([
      ['theme', 'dark'],
      ['yamlContent', 'secret'],
      ['secretObject', '{}'],
    ]);
    const written: string[] = [];
    const storage: KeyValueStore = {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => {
        written.push(key);
        map.set(key, value);
      },
      removeItem: (key) => map.delete(key),
    };
    setup(storage);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.querySelector('#theme-toggle')?.getAttribute('aria-label')).toBe('Switch to light theme');
    expect(map.has('yamlContent')).toBe(false);
    expect(map.has('secretObject')).toBe(false);

    const draft = document.querySelector('#yaml-input') as HTMLTextAreaElement;
    draft.value = demoYaml;
    document.querySelector<HTMLButtonElement>('#process-btn')?.click();
    field('username').value = 'changed';
    field('username').dispatchEvent(new Event('input'));
    expect(written.every((key) => key === 'theme')).toBe(true);

    document.querySelector<HTMLButtonElement>('#theme-toggle')?.click();
    expect(map.get('theme')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('follows the system theme and survives blocked storage', () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;

    localStorage.setItem('theme', 'light');
    setup();
    expect(document.documentElement.dataset.theme).toBe('light');

    localStorage.setItem('theme', 'blue');
    document.body.innerHTML = '<div id="app"></div>';
    setup();
    expect(document.documentElement.dataset.theme).toBe('dark');

    localStorage.clear();
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    document.body.innerHTML = '<div id="app"></div>';
    setup();
    expect(document.documentElement.dataset.theme).toBe('light');

    const blocked: KeyValueStore = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    document.body.innerHTML = '<div id="app"></div>';
    expect(() => setup(blocked)).not.toThrow();
    document.querySelector<HTMLButtonElement>('#theme-toggle')?.click();
    expect(document.documentElement.dataset.theme).toBeTruthy();
  });

  it('ignores metadata edits before a secret is loaded', () => {
    setup();
    for (const id of ['name-input', 'namespace-input', 'type-input']) {
      document.querySelector(`#${id}`)?.dispatchEvent(new Event('change'));
    }
    document.querySelector('#add-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    expect(document.querySelector('#secret-editor')?.hasAttribute('hidden')).toBe(true);
  });

  it('boots from the entry module', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await import('../src/main');
    expect(document.querySelector('h1')?.textContent).toContain('Secret Editor');
  });
});
