import { redactApparentSecrets } from '../../core/src/semantic.js';

/** Preserve source lines while removing common credential literals from portable/provider text. */
export function redactSecurityText(value: string): string {
  return redactApparentSecrets(value)
    .replace(/\bBearer[ \t]+[A-Za-z0-9._~+\/=-]{8,}/gi,'Bearer [REDACTED]')
    .replace(/((?:["']?\b(?:password|passwd|client_secret|access_token|refresh_token|auth_token)["']?)[ \t]*[:=][ \t]*)(["'])([^\r\n]*?)\2/gi,'$1$2[REDACTED]$2')
    .replace(/((?:password|passwd|client_secret|access_token|refresh_token|auth_token)[ \t]*=[ \t]*)([A-Za-z0-9._~+\/=-]{8,})/gi,'$1[REDACTED]');
}
