import { describe, expect, it } from 'vitest';
import basicYaml from './fixtures/basic.yaml?raw';
import stringDataYaml from './fixtures/string-data.yaml?raw';
import unicodeYaml from './fixtures/unicode.yaml?raw';
import {
  addField,
  downloadFilename,
  parseSecret,
  removeField,
  renameField,
  SecretError,
  SECRET_TYPES,
  toYaml,
  typeOptions,
  updateFieldValue,
  updateMetadata,
} from '../src/lib/secret';

const date = new Date('2026-11-24T12:00:00Z');

function secret(body: string): string {
  return `apiVersion: v1\nkind: Secret\nmetadata:\n  name: demo\n${body}`;
}

describe('parseSecret', () => {
  it('keeps text, labels, and annotations, and drops cluster metadata', () => {
    const model = parseSecret(basicYaml);
    expect(model.name).toBe('basic');
    expect(model.namespace).toBe('demo');
    expect(model.labels).toEqual({ app: 'demo' });
    expect(model.annotations).toEqual({ note: 'kept' });
    expect(model.immutable).toBe(true);
    expect(model.fields).toEqual([
      { key: 'username', kind: 'text', value: 'user' },
      { key: 'token', kind: 'text', value: 'token' },
    ]);

    const exported = toYaml(model);
    expect(exported).not.toContain('should-strip');
    expect(exported).not.toContain('resourceVersion');
    expect(exported).toContain('immutable: true');
    expect(parseSecret(exported).fields).toEqual(model.fields);
  });

  it('lets stringData overwrite data and append new keys while keeping binary values', () => {
    const model = parseSecret(stringDataYaml);
    expect(model.fields.map((field) => field.key)).toEqual(['username', 'blob', 'note']);
    expect(model.fields[0]).toEqual({ key: 'username', kind: 'text', value: 'replaced' });
    expect(model.fields[1]).toEqual({ key: 'blob', kind: 'binary', value: '/w==' });
    expect(model.fields[2]).toEqual({ key: 'note', kind: 'text', value: 'hello' });

    const exported = toYaml(model);
    expect(exported).not.toMatch(/^stringData:/m);
    const again = parseSecret(exported);
    expect(again.fields).toEqual(model.fields);
  });

  it('round-trips unicode stringData as canonical base64 data', () => {
    const model = parseSecret(unicodeYaml);
    expect(model.fields).toEqual([{ key: 'city', kind: 'text', value: 'İstanbul' }]);
    expect(parseSecret(toYaml(model)).fields[0]).toEqual(model.fields[0]);
  });

  it('accepts an empty data map, a missing type, and a group apiVersion', () => {
    const empty = parseSecret(secret('data: {}'));
    expect(empty.type).toBe('Opaque');
    expect(empty.fields).toEqual([]);
    expect(toYaml(empty)).toContain('data: {}');

    const grouped = parseSecret(`apiVersion: custom.group/v1\nkind: Secret\nmetadata:\n  name: custom\nstringData:\n  a: b\n`);
    expect(grouped.fields[0]).toEqual({ key: 'a', kind: 'text', value: 'b' });
  });

  it('reads stringData when data is null and preserves multiline text', () => {
    const model = parseSecret(secret('data:\nstringData:\n  note: "line1\\nline2"\n'));
    expect(model.fields).toEqual([{ key: 'note', kind: 'text', value: 'line1\nline2' }]);
    expect(parseSecret(toYaml(model)).fields[0].value).toBe('line1\nline2');
  });

  it('rejects documents that are not a v1 Secret', () => {
    expect(() => parseSecret(':\n  -')).toThrow(SecretError);
    expect(() => parseSecret('')).toThrow(/Kubernetes Secret/);
    expect(() => parseSecret('[]')).toThrow(/Kubernetes Secret/);
    expect(() => parseSecret('kind: ConfigMap\napiVersion: v1\nmetadata:\n  name: x\n')).toThrow(/kind: Secret/);
    expect(() => parseSecret('kind: Secret\napiVersion: v1beta1\nmetadata:\n  name: x\ndata: {}\n')).toThrow(/apiVersion/);
    expect(() => parseSecret('kind: Secret\napiVersion: 1\nmetadata:\n  name: x\ndata: {}\n')).toThrow(/apiVersion/);
    expect(() => parseSecret('kind: Secret\napiVersion: v1\ndata: {}\n')).toThrow(/metadata.name/);
    expect(() => parseSecret('kind: Secret\napiVersion: v1\nmetadata: []\n')).toThrow(/metadata must be a map/);
    expect(() => parseSecret('kind: Secret\napiVersion: v1\nmetadata:\n  name: 1\ndata: {}\n')).toThrow(/metadata.name/);
  });

  it('rejects bad names, namespaces, types, and values', () => {
    expect(() => parseSecret('kind: Secret\napiVersion: v1\nmetadata:\n  name: "  "\ndata: {}\n')).toThrow(/required/);
    expect(() => parseSecret('kind: Secret\napiVersion: v1\nmetadata:\n  name: Nope\ndata: {}\n')).toThrow(/DNS subdomain/);
    expect(() => parseSecret(`kind: Secret\napiVersion: v1\nmetadata:\n  name: ${'a'.repeat(254)}\ndata: {}\n`)).toThrow(/DNS subdomain/);
    expect(() => parseSecret('kind: Secret\napiVersion: v1\nmetadata:\n  name: demo\n  namespace: 1\ndata: {}\n')).toThrow(/Namespace must be a string/);
    expect(() => parseSecret('kind: Secret\napiVersion: v1\nmetadata:\n  name: demo\n  namespace: Prod\ndata: {}\n')).toThrow(/DNS label/);
    expect(() => parseSecret(`kind: Secret\napiVersion: v1\nmetadata:\n  name: demo\n  namespace: ${'a'.repeat(64)}\ndata: {}\n`)).toThrow(/DNS label/);
    expect(() => parseSecret(secret('type: 1\ndata: {}\n'))).toThrow(/type must be a string/);
    expect(() => parseSecret(secret('type: ""\ndata: {}\n'))).toThrow(/type is required/);
    expect(() => parseSecret(secret('type: "bad type"\ndata: {}\n'))).toThrow(/unsupported characters/);
    expect(() => parseSecret(secret('data: []\n'))).toThrow(/data must be a map/);
    expect(() => parseSecret(secret(''))).toThrow(/data or stringData/);
    expect(() => parseSecret(secret('data:\n  count: 1\n'))).toThrow(/data.count must be a string/);
    expect(() => parseSecret(secret('data:\n  blob: "!!!!"\n'))).toThrow(/not valid base64/);
    expect(() => parseSecret(secret('stringData:\n  port: 5432\n'))).toThrow(/stringData.port must be a string/);
    expect(() => parseSecret(secret('stringData:\n  "bad key": nope\n'))).toThrow(/Key must contain/);
    expect(() => parseSecret('kind: Secret\napiVersion: v1\nmetadata:\n  name: demo\n  labels: []\ndata: {}\n')).toThrow(/labels must be a map/);
  });

  it('accepts a dotted name and an empty namespace string', () => {
    const model = parseSecret('kind: Secret\napiVersion: v1\nmetadata:\n  name: my.app\n  namespace: ""\ndata: {}\n');
    expect(model.name).toBe('my.app');
    expect(model.namespace).toBe('');
    expect(toYaml(model)).not.toContain('namespace:');
    expect(model.immutable).toBe(false);
    expect(toYaml(model)).not.toContain('immutable:');
  });
});

describe('edits', () => {
  it('adds, renames, removes, and updates keys without mutating the original', () => {
    const original = parseSecret(secret('stringData:\n  username: ada\n'));
    const added = addField(original, ' .dockerconfigjson ', '{}');
    expect(original.fields).toHaveLength(1);
    expect(added.fields.map((field) => field.key)).toEqual(['username', '.dockerconfigjson']);

    const renamed = renameField(added, 'username', 'user_name');
    expect(renamed.fields[0].key).toBe('user_name');
    expect(renameField(renamed, 'user_name', 'user_name').fields[0].key).toBe('user_name');

    const updated = updateFieldValue(renamed, 'user_name', 'grace');
    expect(updated.fields[0]).toMatchObject({ value: 'grace' });
    expect(removeField(updated, '.dockerconfigjson').fields).toHaveLength(1);
  });

  it('rejects empty, duplicate, missing, and binary edits', () => {
    const model = parseSecret(stringDataYaml);
    expect(() => addField(model, ' ')).toThrow(/cannot be empty/);
    expect(() => addField(model, 'bad key')).toThrow(/Key must contain/);
    expect(() => addField(model, 'a'.repeat(254))).toThrow(/Key must contain/);
    expect(() => addField(model, 'note')).toThrow(/already exists/);
    expect(() => removeField(model, 'missing')).toThrow(/not found/);
    expect(() => renameField(model, 'missing', 'next')).toThrow(/not found/);
    expect(() => renameField(model, 'note', 'username')).toThrow(/already exists/);
    expect(() => updateFieldValue(model, 'missing', 'x')).toThrow(/not found/);
    expect(() => updateFieldValue(model, 'blob', 'x')).toThrow(/cannot be edited/);
  });

  it('updates metadata and warns for known secret types', () => {
    let model = parseSecret(secret('stringData:\n  extra: value\n'));
    expect(model.warnings).toEqual([]);
    model = updateMetadata(model, { name: 'renamed', namespace: 'kube-system', type: 'kubernetes.io/tls' });
    expect(model.name).toBe('renamed');
    expect(model.namespace).toBe('kube-system');
    expect(model.warnings[0]).toContain('tls.crt, tls.key');

    model = addField(model, 'tls.crt', 'cert');
    expect(model.warnings[0]).toContain('tls.key');
    expect(model.warnings[0]).not.toContain('tls.crt,');
    model = addField(model, 'tls.key', 'key');
    expect(model.warnings).toEqual([]);

    expect(updateMetadata(model, { type: 'kubernetes.io/basic-auth' }).warnings[0]).toContain('username, password');
    expect(updateMetadata(model, { type: 'kubernetes.io/ssh-auth' }).warnings[0]).toContain('ssh-privatekey');
    expect(updateMetadata(model, { type: 'kubernetes.io/dockerconfigjson' }).warnings[0]).toContain('.dockerconfigjson');
    expect(updateMetadata(model, { type: 'company.com/special' }).warnings).toEqual([]);
    expect(updateMetadata(model, {}).name).toBe(model.name);

    expect(() => updateMetadata(model, { name: 'Nope' })).toThrow(/DNS subdomain/);
    expect(() => updateMetadata(model, { namespace: 'Prod' })).toThrow(/DNS label/);
    expect(() => updateMetadata(model, { type: 'bad type' })).toThrow(/unsupported characters/);
  });

  it('lists known types and adds a custom current type', () => {
    expect(typeOptions('Opaque')).toEqual([...SECRET_TYPES]);
    expect(typeOptions('company.com/special')).toContain('company.com/special');
  });

  it('builds a safe download filename', () => {
    expect(downloadFilename('My Secret!', date)).toBe('my-secret-2026-11-24.yaml');
    expect(downloadFilename('my.app', date)).toBe('my.app-2026-11-24.yaml');
    expect(downloadFilename('...', date)).toBe('secret-2026-11-24.yaml');
    expect(downloadFilename('a---b', date)).toBe('a-b-2026-11-24.yaml');
  });
});
