import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';

export const phases = ['ideation', 'requirements', 'external-design', 'internal-design', 'task-planning', 'development'];
export const roles = ['orchestrator', 'ideation', 'requirements', 'external-design', 'internal-design', 'task-planner', 'implementer', 'reviewer'];
const schema = JSON.parse(readFileSync(new URL('../schemas/runtime.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true });
ajv.addSchema(schema);
ajv.addSchema(JSON.parse(readFileSync(new URL('../schemas/operations.schema.json', import.meta.url), 'utf8')));
const validators = new Map();

export class SddError extends Error {
  constructor(code, message, nextAction = 'Confirm the input and retry with the current revision.') {
    super(message);
    this.code = code;
    this.nextAction = nextAction;
  }
}

export function requireCondition(condition, code, message, nextAction) {
  if (!condition) throw new SddError(code, message, nextAction);
}

export function validate(kind, value) {
  if (!validators.has(kind)) validators.set(kind, ajv.compile({ $ref: `urn:sdd:runtime:1#/$defs/${kind}` }));
  const check = validators.get(kind);
  requireCondition(check(value), 'INVALID_FORMAT', `${kind}: ${ajv.errorsText(check.errors, { dataVar: kind })}`);
  return value;
}

export function validateRequest(request) {
  validate('request', request);
  requireCondition(!['__proto__', 'constructor', 'prototype'].includes(request.operationId), 'INVALID_FORMAT', 'Reserved operation ID.');
  const key = `payload:${request.operation}`;
  if (!validators.has(key)) validators.set(key, ajv.compile({ $ref: `urn:sdd:operations:1#/$defs/${request.operation}` }));
  const check = validators.get(key);
  requireCondition(check(request.payload), 'INVALID_FORMAT', ajv.errorsText(check.errors, { dataVar: request.operation }));
  return request;
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function hash(content) {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

export function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function redact(text) {
  return String(text)
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[REDACTED]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]')
    .replace(/((?:password|api[_-]?key|access[_-]?token|secret)["']?\s*[:=]\s*)["']?[^\s,"'}]+/gi, '$1[REDACTED]')
    .replace(/([?&](?:token|key|password|secret)=)[^&\s"']+/gi, '$1[REDACTED]');
}

export function assertNoSecrets(value) {
  const serialized = json(value);
  requireCondition(redact(serialized) === serialized, 'INVALID_FORMAT', 'Secret-like data is not accepted. Supply a non-secret reference instead.');
}

export function validateTasks(value) {
  validate('tasks', value);
  const index = new Map(value.tasks.map(task => [task.id, task]));
  requireCondition(index.size === value.tasks.length, 'INVALID_FORMAT', 'Duplicate task IDs.');
  const visiting = new Set();
  const visited = new Set();
  function visit(task) {
    requireCondition(!visiting.has(task.id), 'INVALID_FORMAT', 'Cyclic task dependencies.');
    if (visited.has(task.id)) return;
    visiting.add(task.id);
    for (const dependency of task.dependsOn) {
      requireCondition(index.has(dependency), 'INVALID_FORMAT', `Unknown dependency: ${dependency}`);
      visit(index.get(dependency));
    }
    requireCondition(task.type !== 'behavior' || task.verification.method === 'tdd', 'INVALID_FORMAT', 'Behavior tasks require TDD.');
    visiting.delete(task.id);
    visited.add(task.id);
  }
  for (const task of value.tasks) visit(task);
  return value;
}