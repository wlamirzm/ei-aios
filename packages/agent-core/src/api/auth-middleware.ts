// ==============================================================================
// BACKEND AUTHENTICATION & AUTHORIZATION MIDDLEWARE (SPRINT 1 - BKL-004)
// Protege rotas críticas: /api/v1/system/*, /api/v1/approvals/*, /api/v1/emails/* e administração de agentes
// ==============================================================================

import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

function getSigningSecret(): string {
  return process.env.JWT_SECRET || env.ADMIN_API_TOKEN || 'super-secret-jwt-token-with-at-least-32-characters-long';
}

export interface FounderTokenVerification {
  valid: boolean;
  subject?: string;
  role?: string;
  reason?: string;
}

/**
 * Emite um token JWT HS256 assinado pelo backend para o Fundador.
 */
export function createFounderAuthToken(
  email: string = env.FOUNDER_EMAIL,
  expiresInSeconds: number = 60 * 60 * 24 * 7
): string {
  const secret = getSigningSecret();
  const nowSec = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: email,
      role: 'founder_admin',
      iss: 'ei-aios-agent-core',
      iat: nowSec,
      exp: nowSec + expiresInSeconds
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Valida criptograficamente um token Bearer JWT ou Token Soberano de Administração.
 */
export function verifyFounderAuthToken(token?: string | null): FounderTokenVerification {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Token ausente' };
  }

  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  if (!cleanToken) {
    return { valid: false, reason: 'Token vazio' };
  }

  // 1. Verifica token administrativo estático configurado no servidor
  if (
    cleanToken === env.ADMIN_API_TOKEN ||
    (env.SUPABASE_SERVICE_ROLE_KEY &&
      env.SUPABASE_SERVICE_ROLE_KEY !== 'mock-service-role-key' &&
      cleanToken === env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    return {
      valid: true,
      subject: env.FOUNDER_EMAIL,
      role: 'founder_admin'
    };
  }

  // 2. Verifica estrutura e assinatura JWT HS256
  const parts = cleanToken.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'Formato de token inválido' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const secret = getSigningSecret();
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  const sigBuf = Buffer.from(signatureB64!, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, reason: 'Assinatura criptográfica inválida' };
  }

  try {
    const decoded = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);
    if (decoded.exp && Number(decoded.exp) < nowSec) {
      return { valid: false, reason: 'Token expirado' };
    }
    return {
      valid: true,
      subject: decoded.sub || env.FOUNDER_EMAIL,
      role: decoded.role || 'founder_admin'
    };
  } catch {
    return { valid: false, reason: 'Payload JWT malformado' };
  }
}

/**
 * Middleware Express que protege rotas administrativas, de aprovação e de credenciais.
 */
export function requireFounderAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const customHeader = req.headers['x-ei-admin-token'];
  const rawToken =
    typeof authHeader === 'string' && authHeader.trim()
      ? authHeader
      : typeof customHeader === 'string'
      ? customHeader
      : null;

  const verification = verifyFounderAuthToken(rawToken);
  if (!verification.valid) {
    res.status(401).json({
      success: false,
      error: 'Acesso não autorizado. Esta rota crítica exige token válido de governança do fundador.',
      reason: verification.reason
    });
    return;
  }

  (req as any).founderAuth = verification;
  next();
}
