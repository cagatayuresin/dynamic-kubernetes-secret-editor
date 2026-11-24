import { dump, load } from 'js-yaml';
import { decodeBase64, encodeBase64 } from './base64';

export class SecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretError';
  }
}

export const SECRET_TYPES = [
  'Opaque',
  'kubernetes.io/tls',
  'kubernetes.io/basic-auth',
  'kubernetes.io/ssh-auth',
  'kubernetes.io/dockerconfigjson',
] as const;

const TYPE_REQUIREMENTS: Record<string, readonly string[]> = {
  'kubernetes.io/tls': ['tls.crt', 'tls.key'],
  'kubernetes.io/basic-auth': ['username', 'password'],
  'kubernetes.io/ssh-auth': ['ssh-privatekey'],
  'kubernetes.io/dockerconfigjson': ['.dockerconfigjson'],
};

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
const NAMESPACE_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const KEY_PATTERN = /^[-._a-zA-Z0-9]+$/;
const TYPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9./-]*$/;

export type SecretField =
  | { key: string; kind: 'text'; value: string }
  | { key: string; kind: 'binary'; value: string };

export interface SecretModel {
  name: string;
  namespace: string;
  type: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  immutable: boolean;
  fields: SecretField[];
  warnings: string[];
}

export interface MetadataPatch {
  name?: string;
  namespace?: string;
  type?: string;
}

export function typeOptions(current: string): string[] {
  const known: string[] = [...SECRET_TYPES];
  if (!known.includes(current)) {
    known.push(current);
  }
  return known;
}

export function warningsFor(type: string, fields: SecretField[]): string[] {
  const required = TYPE_REQUIREMENTS[type];
  if (!required) {
    return [];
  }
  const present = new Set(fields.map((field) => field.key));
  const missing = required.filter((key) => !present.has(key));
  if (missing.length === 0) {
    return [];
  }
  return [`${type} usually includes ${missing.join(', ')}`];
}

export function parseSecret(yamlText: string): SecretModel {
  if (!yamlText.trim()) {
    throw new SecretError('YAML must be a Kubernetes Secret');
  }

  let parsed: unknown;
  try {
    parsed = load(yamlText);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown YAML error';
    throw new SecretError(`Failed to parse YAML: ${message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SecretError('YAML must be a Kubernetes Secret');
  }

  const doc = parsed as Record<string, unknown>;
  if (doc.kind !== 'Secret') {
    throw new SecretError('YAML must be a Kubernetes Secret (kind: Secret)');
  }
  if (typeof doc.apiVersion !== 'string' || !isV1(doc.apiVersion)) {
    throw new SecretError('Secret must use apiVersion v1');
  }

  const metadata = readMap(doc.metadata, 'metadata');
  if (!metadata || typeof metadata.name !== 'string') {
    throw new SecretError('Secret must have metadata.name');
  }

  const name = assertName(metadata.name);
  const namespace = readNamespace(metadata);
  const type = readType(doc);

  const data = readOptionalMap(doc.data, 'data');
  const stringData = readOptionalMap(doc.stringData, 'stringData');
  if (!data && !stringData) {
    throw new SecretError('Secret must have either data or stringData');
  }

  const fields = mergeFields(data, stringData);
  const labels = readStringMap(metadata.labels, 'metadata.labels');
  const annotations = readStringMap(metadata.annotations, 'metadata.annotations');

  return {
    name,
    namespace,
    type,
    labels,
    annotations,
    immutable: doc.immutable === true,
    fields,
    warnings: warningsFor(type, fields),
  };
}

export function toYaml(model: SecretModel): string {
  const metadata: Record<string, unknown> = { name: model.name };
  if (model.namespace) {
    metadata.namespace = model.namespace;
  }
  if (Object.keys(model.labels).length > 0) {
    metadata.labels = model.labels;
  }
  if (Object.keys(model.annotations).length > 0) {
    metadata.annotations = model.annotations;
  }

  const data: Record<string, string> = {};
  for (const field of model.fields) {
    data[field.key] = field.kind === 'binary' ? field.value : encodeBase64(field.value);
  }

  const doc: Record<string, unknown> = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata,
    type: model.type,
    data,
  };
  if (model.immutable) {
    doc.immutable = true;
  }

  return dump(doc, { lineWidth: -1, noRefs: true, sortKeys: false });
}

export function addField(model: SecretModel, key: string, value = ''): SecretModel {
  const nextKey = assertKey(key);
  if (model.fields.some((field) => field.key === nextKey)) {
    throw new SecretError(`Key "${nextKey}" already exists`);
  }
  return finish({
    ...clone(model),
    fields: [...model.fields.map(copyField), { key: nextKey, kind: 'text', value }],
  });
}

export function removeField(model: SecretModel, key: string): SecretModel {
  if (!model.fields.some((field) => field.key === key)) {
    throw new SecretError(`Key "${key}" was not found`);
  }
  return finish({
    ...clone(model),
    fields: model.fields.filter((field) => field.key !== key).map(copyField),
  });
}

export function renameField(model: SecretModel, from: string, to: string): SecretModel {
  const nextKey = assertKey(to);
  const index = model.fields.findIndex((field) => field.key === from);
  if (index === -1) {
    throw new SecretError(`Key "${from}" was not found`);
  }
  if (nextKey !== from && model.fields.some((field) => field.key === nextKey)) {
    throw new SecretError(`Key "${nextKey}" already exists`);
  }
  if (nextKey === from) {
    return clone(model);
  }
  const fields = model.fields.map(copyField);
  fields[index] = { ...fields[index], key: nextKey };
  return finish({ ...clone(model), fields });
}

export function updateFieldValue(model: SecretModel, key: string, value: string): SecretModel {
  const index = model.fields.findIndex((field) => field.key === key);
  if (index === -1) {
    throw new SecretError(`Key "${key}" was not found`);
  }
  const current = model.fields[index];
  if (current.kind === 'binary') {
    throw new SecretError('Binary values stay encoded and cannot be edited');
  }
  const fields = model.fields.map(copyField);
  fields[index] = { key, kind: 'text', value };
  return finish({ ...clone(model), fields });
}

export function updateMetadata(model: SecretModel, patch: MetadataPatch): SecretModel {
  const next = clone(model);
  if (patch.name !== undefined) {
    next.name = assertName(patch.name);
  }
  if (patch.namespace !== undefined) {
    next.namespace = assertNamespace(patch.namespace);
  }
  if (patch.type !== undefined) {
    next.type = assertType(patch.type);
  }
  return finish(next);
}

export function downloadFilename(name: string, now = new Date()): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^[-.]+/, '')
    .replace(/[-.]+$/, '')
    .replace(/-{2,}/g, '-') || 'secret';
  const day = now.toISOString().slice(0, 10);
  return `${slug}-${day}.yaml`;
}

function finish(model: SecretModel): SecretModel {
  return { ...model, warnings: warningsFor(model.type, model.fields) };
}

function clone(model: SecretModel): SecretModel {
  return {
    ...model,
    labels: { ...model.labels },
    annotations: { ...model.annotations },
    fields: model.fields.map(copyField),
    warnings: [...model.warnings],
  };
}

function copyField(field: SecretField): SecretField {
  return { ...field };
}

function mergeFields(
  data: Record<string, unknown> | null,
  stringData: Record<string, unknown> | null,
): SecretField[] {
  const fields: SecretField[] = [];
  const indexByKey = new Map<string, number>();

  for (const [key, raw] of Object.entries(data ?? {})) {
    assertKey(key);
    if (typeof raw !== 'string') {
      throw new SecretError(`data.${key} must be a string`);
    }
    const decoded = decodeBase64(raw);
    if (decoded.status === 'invalid') {
      throw new SecretError(`data.${key} is not valid base64`);
    }
    const field: SecretField = decoded.status === 'binary'
      ? { key, kind: 'binary', value: raw.replace(/\s+/g, '') }
      : { key, kind: 'text', value: decoded.text };
    indexByKey.set(key, fields.length);
    fields.push(field);
  }

  for (const [key, raw] of Object.entries(stringData ?? {})) {
    assertKey(key);
    if (typeof raw !== 'string') {
      throw new SecretError(`stringData.${key} must be a string`);
    }
    const field: SecretField = { key, kind: 'text', value: raw };
    const existing = indexByKey.get(key);
    if (existing === undefined) {
      indexByKey.set(key, fields.length);
      fields.push(field);
    } else {
      fields[existing] = field;
    }
  }

  return fields;
}

function isV1(apiVersion: string): boolean {
  return apiVersion === 'v1' || apiVersion.endsWith('/v1');
}

function readNamespace(metadata: Record<string, unknown>): string {
  if (metadata.namespace === undefined) {
    return '';
  }
  if (typeof metadata.namespace !== 'string') {
    throw new SecretError('Namespace must be a string');
  }
  return assertNamespace(metadata.namespace);
}

function readType(doc: Record<string, unknown>): string {
  if (doc.type === undefined) {
    return 'Opaque';
  }
  if (typeof doc.type !== 'string') {
    throw new SecretError('Secret type must be a string');
  }
  return assertType(doc.type);
}

function readMap(value: unknown, label: string): Record<string, unknown> | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new SecretError(`${label} must be a map`);
  }
  return value as Record<string, unknown>;
}

function readOptionalMap(value: unknown, label: string): Record<string, unknown> | null {
  if (value === undefined || value === null) {
    return null;
  }
  return readMap(value, label);
}

function readStringMap(value: unknown, label: string): Record<string, string> {
  const map = readMap(value, label);
  if (!map) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(map)) {
    if (typeof entry === 'string') {
      result[key] = entry;
    }
  }
  return result;
}

function assertName(value: string): string {
  const name = value.trim();
  if (!name) {
    throw new SecretError('Secret name is required');
  }
  if (name.length > 253 || !NAME_PATTERN.test(name)) {
    throw new SecretError('Secret name must be a lowercase DNS subdomain');
  }
  return name;
}

function assertNamespace(value: string): string {
  const namespace = value.trim();
  if (!namespace) {
    return '';
  }
  if (namespace.length > 63 || !NAMESPACE_PATTERN.test(namespace)) {
    throw new SecretError('Namespace must be a lowercase DNS label');
  }
  return namespace;
}

function assertType(value: string): string {
  const type = value.trim();
  if (!type) {
    throw new SecretError('Secret type is required');
  }
  if (!TYPE_PATTERN.test(type)) {
    throw new SecretError('Secret type contains unsupported characters');
  }
  return type;
}

function assertKey(value: string): string {
  const key = value.trim();
  if (!key) {
    throw new SecretError('Key cannot be empty');
  }
  if (key.length > 253 || !KEY_PATTERN.test(key)) {
    throw new SecretError('Key must contain only letters, numbers, "-", "_" or "."');
  }
  return key;
}
