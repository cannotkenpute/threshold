/**
 * THRESHOLD Multiplayer — Logger (browser ESM). Section 59.
 * Leveled logging with mandatory secret redaction. Never logs tokens/keys/DB URLs.
 */
export const LOG_LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40, silent: 99 });

const SECRET_KEY_RE = /(service_role|secret|password|jwt|apikey|api_key|authorization|token|anon_key|connection|postgres)/i;
const JWT_RE = /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g;
const PG_URL_RE = /postgres(?:ql)?:\/\/[^\s"']+/gi;
const SB_KEY_RE = /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g;

export function redact(value, depth) {
  depth = depth == null ? 0 : depth;
  if (depth > 6) return '[max_depth]';
  if (typeof value === 'string') {
    return value.replace(JWT_RE, '[REDACTED_JWT]')
                .replace(PG_URL_RE, '[REDACTED_PG_URL]')
                .replace(SB_KEY_RE, '[REDACTED_KEY]');
  }
  if (Array.isArray(value)) return value.map(function (v) { return redact(v, depth + 1); });
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) {
      out[k] = SECRET_KEY_RE.test(k) ? '[REDACTED]' : redact(value[k], depth + 1);
    }
    return out;
  }
  return value;
}

export class Logger {
  constructor(opts) {
    opts = opts || {};
    this.level = LOG_LEVELS[opts.level || 'info'];
    this.scope = opts.scope || 'mp';
    this.sink = opts.sink || (typeof console !== 'undefined' ? console : null);
  }
  _log(levelName, msg, data) {
    if (LOG_LEVELS[levelName] < this.level || !this.sink) return;
    const line = '[' + this.scope + '] ' + msg;
    const payload = data === undefined ? undefined : redact(data);
    const fn = this.sink[levelName] || this.sink.log;
    if (payload === undefined) fn.call(this.sink, line);
    else fn.call(this.sink, line, payload);
  }
  debug(m, d) { this._log('debug', m, d); }
  info(m, d) { this._log('info', m, d); }
  warn(m, d) { this._log('warn', m, d); }
  error(m, d) { this._log('error', m, d); }
}

export const logger = new Logger({ scope: 'threshold-mp' });
