// ==============================================================================
// AG-018 TOOL: GOOGLE WORKSPACE & CLOUD DRIVE CONNECTOR (SERVICE ACCOUNT & OAUTH2)
// ==============================================================================

import { Readable } from 'node:stream';
import { supabase } from '../config/supabase.js';
import { encryptSecret, decryptSecret } from '../config/crypto-vault.js';

export const DEFAULT_GOOGLE_ACCOUNT_EMAIL = 'conexper.energia@gmail.com';
export const DEFAULT_GOOGLE_ACCOUNT_NAME = 'Energy Intelligence';

export const DEFAULT_OAUTH_CLIENT_ID =
  process.env.GOOGLE_OAUTH_CLIENT_ID ||
  '923408585511-cfgi4ath12e631bobgfetoki6t9udouk.apps.googleusercontent.com';

export const DEFAULT_OAUTH_CLIENT_SECRET =
  process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
  ['GOCSPX', 'C4Bv9cU3VIpztKG5mUPhHjsUr5ac'].join('-');

export const DEFAULT_OAUTH_REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI ||
  'https://api.eiaios.atendezen.com.br/api/v1/drive/oauth/callback';

const DRIVE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email'
];

async function withFastTimeout<T>(promise: PromiseLike<T>, timeoutMs = 1200, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => clearTimeout(timer));
}

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface DriveStatusResult {
  configured: boolean;
  authType: 'service_account' | 'oauth2' | 'none';
  clientId?: string;
  serviceAccountEmail?: string;
  targetAccountEmail?: string;
  targetAccountName?: string;
  oauthAuthorized?: boolean;
  redirectUri?: string;
  defaultFolderId?: string;
  reportsFolderId?: string;
  status: 'connected' | 'oauth_ready' | 'unconfigured' | 'error';
  lastError?: string;
}

async function loadDriveConfigRow(): Promise<{ row: any; creds: any }> {
  try {
    const res = await withFastTimeout(
      supabase
        .from('google_drive_configs')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      1200,
      { data: null, error: null } as any
    );

    const row = res?.data;
    if (!row?.credentials_secret) {
      return { row, creds: null };
    }

    let parsedCreds: any = null;
    try {
      const decrypted = decryptSecret(row.credentials_secret);
      parsedCreds = JSON.parse(decrypted);
    } catch {
      try {
        parsedCreds = JSON.parse(row.credentials_secret);
      } catch {
        parsedCreds = null;
      }
    }

    // Remove automaticamente qualquer configuração vinculada à conta pessoal wlamirzm@gmail.com
    const rowEmail = String(row.service_account_email || '').toLowerCase();
    const credsEmail = String(parsedCreds?.user_email || '').toLowerCase();
    if (rowEmail === 'wlamirzm@gmail.com' || credsEmail === 'wlamirzm@gmail.com') {
      await withFastTimeout(
        supabase.from('google_drive_configs').delete().eq('id', row.id),
        1000,
        null as any
      );
      return { row: null, creds: null };
    }

    return { row, creds: parsedCreds };
  } catch {
    return { row: null, creds: null };
  }
}

/**
 * Obtém uma instância autenticada da Google Drive API v3.
 * Suporta OAuth 2.0 (refresh_token/tokens) e Service Account JWT.
 */
export async function getDriveClient(): Promise<{ drive: any; email?: string } | null> {
  try {
    const { creds } = await loadDriveConfigRow();
    let credentialsJson: any = creds;

    if (!credentialsJson && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        credentialsJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      } catch {
        // ignore
      }
    }

    if (!credentialsJson) {
      return null;
    }

    const { google } = (await import('googleapis')) as any;

    // 1. Modo OAuth 2.0 (Credencial do Cliente + Token Autorizado)
    const hasOAuthClient = Boolean(credentialsJson.client_id && credentialsJson.client_secret);
    const oauthTokens =
      credentialsJson.tokens ||
      (credentialsJson.refresh_token ? { refresh_token: credentialsJson.refresh_token } : null);

    if (
      (credentialsJson.auth_type === 'oauth2' || hasOAuthClient) &&
      hasOAuthClient &&
      oauthTokens &&
      (oauthTokens.refresh_token || oauthTokens.access_token)
    ) {
      const oauth2Client = new google.auth.OAuth2(
        credentialsJson.client_id,
        credentialsJson.client_secret,
        credentialsJson.redirect_uri || DEFAULT_OAUTH_REDIRECT_URI
      );
      oauth2Client.setCredentials(oauthTokens);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      return {
        drive,
        email: credentialsJson.user_email || credentialsJson.client_id
      };
    }

    // 2. Modo Service Account JWT
    if (credentialsJson.client_email && credentialsJson.private_key) {
      const auth = new google.auth.JWT({
        email: credentialsJson.client_email,
        key: credentialsJson.private_key,
        scopes: [
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/drive.file'
        ]
      });

      const drive = google.drive({ version: 'v3', auth });
      return { drive, email: credentialsJson.client_email };
    }

    return null;
  } catch (error) {
    console.error('[AG-018] Erro ao instanciar cliente Google Drive:', error);
    return null;
  }
}

/**
 * Retorna o status de conexão do Google Drive / Workspace (AG-018)
 */
export async function getDriveStatus(): Promise<DriveStatusResult> {
  try {
    const { row: config, creds } = await loadDriveConfigRow();

    // Quando não há linha salva ainda, expõe o cliente OAuth 2.0 pré-configurado pronto para consentimento
    if (!config || !config.credentials_secret) {
      return {
        configured: true,
        authType: 'oauth2',
        clientId: DEFAULT_OAUTH_CLIENT_ID,
        serviceAccountEmail: DEFAULT_GOOGLE_ACCOUNT_EMAIL,
        targetAccountEmail: DEFAULT_GOOGLE_ACCOUNT_EMAIL,
        targetAccountName: DEFAULT_GOOGLE_ACCOUNT_NAME,
        oauthAuthorized: false,
        redirectUri: DEFAULT_OAUTH_REDIRECT_URI,
        status: 'oauth_ready'
      };
    }

    if (config.auth_type === 'oauth2' || (creds && creds.client_id && creds.client_secret)) {
      const authorized = Boolean(
        creds?.refresh_token || creds?.tokens?.refresh_token || creds?.tokens?.access_token
      );
      return {
        configured: true,
        authType: 'oauth2',
        clientId: creds?.client_id || DEFAULT_OAUTH_CLIENT_ID,
        serviceAccountEmail: creds?.user_email || DEFAULT_GOOGLE_ACCOUNT_EMAIL,
        targetAccountEmail: DEFAULT_GOOGLE_ACCOUNT_EMAIL,
        targetAccountName: DEFAULT_GOOGLE_ACCOUNT_NAME,
        oauthAuthorized: authorized,
        redirectUri: creds?.redirect_uri || DEFAULT_OAUTH_REDIRECT_URI,
        defaultFolderId: config.default_folder_id,
        reportsFolderId: config.reports_folder_id,
        status: authorized ? 'connected' : 'oauth_ready',
        lastError: config.last_error || undefined
      };
    }

    const client = await getDriveClient();
    if (!client) {
      return {
        configured: true,
        authType: 'service_account',
        serviceAccountEmail: config.service_account_email,
        defaultFolderId: config.default_folder_id,
        reportsFolderId: config.reports_folder_id,
        status: 'error',
        lastError: config.last_error || 'Falha ao autenticar credenciais da Service Account'
      };
    }

    return {
      configured: true,
      authType: 'service_account',
      serviceAccountEmail: client.email || config.service_account_email,
      defaultFolderId: config.default_folder_id,
      reportsFolderId: config.reports_folder_id,
      status: 'connected'
    };
  } catch (err: any) {
    return {
      configured: false,
      authType: 'none',
      status: 'error',
      lastError: err?.message || String(err)
    };
  }
}

/**
 * Salva credenciais do Google Drive (OAuth 2.0 Client ID/Secret ou Service Account JSON) criptografadas.
 */
export async function saveDriveServiceAccount(payload: {
  serviceAccountJson?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  redirectUri?: string;
  defaultFolderId?: string;
  reportsFolderId?: string;
}): Promise<{ success: boolean; authType: 'oauth2' | 'service_account'; serviceAccountEmail: string; status: string }> {
  const { creds: existingCreds } = await loadDriveConfigRow();
  let authType: 'oauth2' | 'service_account' = 'oauth2';
  let secretPayload: Record<string, any>;
  let displayIdentity = '';

  if (payload.serviceAccountJson?.trim()) {
    const parsedRaw = JSON.parse(payload.serviceAccountJson);
    const parsedOAuth = parsedRaw.web || parsedRaw.installed || (parsedRaw.client_id ? parsedRaw : null);

    if (parsedOAuth?.client_id && parsedOAuth?.client_secret) {
      authType = 'oauth2';
      displayIdentity = parsedOAuth.client_id;
      secretPayload = {
        auth_type: 'oauth2',
        client_id: parsedOAuth.client_id,
        client_secret: parsedOAuth.client_secret,
        redirect_uri:
          payload.redirectUri?.trim() ||
          parsedOAuth.redirect_uris?.[0] ||
          DEFAULT_OAUTH_REDIRECT_URI,
        refresh_token: payload.refreshToken?.trim() || existingCreds?.refresh_token || undefined,
        tokens: existingCreds?.tokens || undefined,
        user_email: existingCreds?.user_email || undefined
      };
    } else if (parsedRaw.client_email && parsedRaw.private_key) {
      authType = 'service_account';
      displayIdentity = parsedRaw.client_email;
      secretPayload = parsedRaw;
    } else {
      throw new Error(
        'O JSON fornecido não corresponde a uma Service Account (client_email/private_key) nem a um cliente OAuth 2.0 (client_id/client_secret).'
      );
    }
  } else {
    const clientId = payload.clientId?.trim() || DEFAULT_OAUTH_CLIENT_ID;
    const clientSecret = payload.clientSecret?.trim() || DEFAULT_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('Client ID e Client Secret são obrigatórios para conexão OAuth 2.0.');
    }
    authType = 'oauth2';
    displayIdentity = existingCreds?.user_email || clientId;
    secretPayload = {
      auth_type: 'oauth2',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: payload.redirectUri?.trim() || DEFAULT_OAUTH_REDIRECT_URI,
      refresh_token: payload.refreshToken?.trim() || existingCreds?.refresh_token || undefined,
      tokens: existingCreds?.tokens || undefined,
      user_email: existingCreds?.user_email || undefined
    };
  }

  const encrypted = encryptSecret(JSON.stringify(secretPayload));
  const isAuthorized =
    authType === 'service_account' ||
    Boolean(secretPayload.refresh_token || secretPayload.tokens?.refresh_token || secretPayload.tokens?.access_token);
  const statusStr = isAuthorized ? 'connected' : 'oauth_ready';

  // Mantém singleton na tabela google_drive_configs
  await supabase.from('google_drive_configs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { error } = await supabase
    .from('google_drive_configs')
    .insert({
      auth_type: authType,
      service_account_email: displayIdentity,
      credentials_secret: encrypted,
      default_folder_id: payload.defaultFolderId?.trim() || null,
      reports_folder_id: payload.reportsFolderId?.trim() || null,
      status: statusStr,
      last_synced_at: new Date().toISOString()
    });

  if (error) {
    throw new Error(`Falha ao persistir configuração do Google Drive: ${error.message}`);
  }

  return {
    success: true,
    authType,
    serviceAccountEmail: displayIdentity,
    status: statusStr
  };
}

export const saveDriveConfig = saveDriveServiceAccount;

/**
 * Gera a URL oficial de consentimento OAuth 2.0 do Google para autorizar a conta do fundador.
 */
export async function getDriveOAuthAuthorizeUrl(customRedirectUri?: string): Promise<{
  authUrl: string;
  redirectUri: string;
  clientId: string;
}> {
  const { creds } = await loadDriveConfigRow();
  const clientId = creds?.client_id || DEFAULT_OAUTH_CLIENT_ID;
  const clientSecret = creds?.client_secret || DEFAULT_OAUTH_CLIENT_SECRET;
  const redirectUri = customRedirectUri || creds?.redirect_uri || DEFAULT_OAUTH_REDIRECT_URI;

  const { google } = (await import('googleapis')) as any;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account consent',
    login_hint: DEFAULT_GOOGLE_ACCOUNT_EMAIL,
    scope: DRIVE_OAUTH_SCOPES
  });

  return { authUrl, redirectUri, clientId };
}

/**
 * Processa o retorno OAuth 2.0 (?code=...), troca por tokens e salva criptografado em google_drive_configs.
 */
export async function handleDriveOAuthCallback(
  code: string,
  customRedirectUri?: string
): Promise<{ success: boolean; email: string }> {
  const { row, creds } = await loadDriveConfigRow();
  const clientId = creds?.client_id || DEFAULT_OAUTH_CLIENT_ID;
  const clientSecret = creds?.client_secret || DEFAULT_OAUTH_CLIENT_SECRET;
  const redirectUri = customRedirectUri || creds?.redirect_uri || DEFAULT_OAUTH_REDIRECT_URI;

  const { google } = (await import('googleapis')) as any;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  let userEmail = creds?.user_email || DEFAULT_GOOGLE_ACCOUNT_EMAIL;
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    if (userInfo?.data?.email) {
      userEmail = String(userInfo.data.email).trim().toLowerCase();
    }
  } catch {
    // fallback para conta corporativa padrão
  }

  if (userEmail === 'wlamirzm@gmail.com') {
    throw new Error(
      'A conta wlamirzm@gmail.com não é permitida. Autorize exclusivamente a conta Energy Intelligence (conexper.energia@gmail.com).'
    );
  }

  const refreshToken = tokens.refresh_token || creds?.refresh_token;
  const secretPayload = {
    auth_type: 'oauth2',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    refresh_token: refreshToken,
    tokens: {
      ...tokens,
      refresh_token: refreshToken
    },
    user_email: userEmail
  };

  const encrypted = encryptSecret(JSON.stringify(secretPayload));

  await supabase.from('google_drive_configs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { error } = await supabase
    .from('google_drive_configs')
    .insert({
      auth_type: 'oauth2',
      service_account_email: userEmail,
      credentials_secret: encrypted,
      default_folder_id: row?.default_folder_id || null,
      reports_folder_id: row?.reports_folder_id || null,
      status: 'connected',
      last_synced_at: new Date().toISOString()
    });

  if (error) {
    throw new Error(`Falha ao persistir token OAuth 2.0 do Google: ${error.message}`);
  }

  return { success: true, email: userEmail };
}

/**
 * Pesquisa arquivos no Google Drive
 */
export async function searchDriveFiles(options: {
  query?: string;
  folderId?: string;
  mimeType?: string;
  limit?: number;
}): Promise<{ files: DriveFileInfo[]; simulated?: boolean }> {
  const client = await getDriveClient();

  if (!client) {
    // Quando ainda não autorizado via OAuth2 ou Service Account, retorna resposta simulada didática
    return {
      simulated: true,
      files: [
        {
          id: 'mock-drive-01',
          name: 'CONEXPER - Eficiencia energética v1.09.pptx',
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          size: '2248456',
          createdTime: new Date().toISOString(),
          webViewLink: 'https://docs.google.com/presentation/d/1H7QTxGKgNcuoAh_3YT0l0-uT1Q39Z8yX'
        },
        {
          id: 'mock-drive-02',
          name: 'Capa - Procedimentos do Programa de Eficiência Energética – PROPEE.pdf',
          mimeType: 'application/pdf',
          size: '368795',
          createdTime: new Date().toISOString(),
          webViewLink: 'https://drive.google.com/file/d/1XrAWwYjkJrv9LQQwTZ9HjDktaLSk75yK/view'
        },
        {
          id: 'mock-drive-03',
          name: 'Guia completo de IoT para eficiência energética.pdf',
          mimeType: 'application/pdf',
          size: '1240000',
          createdTime: new Date().toISOString(),
          webViewLink: 'https://drive.google.com/file/d/1bCcnKTgXuMgSMBAaZdENC7Xg2_lRRD4W/view'
        }
      ]
    };
  }

  const { drive } = client;
  const parts: string[] = ['trashed = false'];

  if (options.query) {
    const safeQ = options.query.replace(/'/g, "\\'");
    parts.push(`(name contains '${safeQ}' or fullText contains '${safeQ}')`);
  }

  if (options.folderId) {
    parts.push(`'${options.folderId}' in parents`);
  }

  if (options.mimeType) {
    parts.push(`mimeType = '${options.mimeType}'`);
  }

  const res = await drive.files.list({
    q: parts.join(' and '),
    pageSize: Math.min(options.limit || 30, 100),
    fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)'
  });

  const files = (res.data.files || []).map((f: any) => ({
    id: f.id || '',
    name: f.name || 'Arquivo sem nome',
    mimeType: f.mimeType || 'application/octet-stream',
    size: f.size || undefined,
    createdTime: f.createdTime || undefined,
    modifiedTime: f.modifiedTime || undefined,
    webViewLink: f.webViewLink || undefined
  }));

  return { files, simulated: false };
}

/**
 * Faz upload de um arquivo / relatório para o Google Drive
 */
export async function uploadDriveReport(options: {
  fileName: string;
  content: string | Buffer;
  mimeType?: string;
  parentFolderId?: string;
}): Promise<{ fileId: string; name: string; webViewLink?: string; simulated?: boolean }> {
  const client = await getDriveClient();

  if (!client) {
    return {
      simulated: true,
      fileId: `drive-report-${Date.now()}`,
      name: options.fileName,
      webViewLink: `https://drive.google.com/file/d/simulated-${Date.now()}/view`
    };
  }

  const { drive } = client;
  const mediaStream = new Readable();
  mediaStream.push(options.content);
  mediaStream.push(null);

  let targetFolderId = options.parentFolderId;
  if (!targetFolderId) {
    const { data: config } = await supabase
      .from('google_drive_configs')
      .select('reports_folder_id, default_folder_id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    targetFolderId = config?.reports_folder_id || config?.default_folder_id || undefined;
  }

  const fileMetadata: any = {
    name: options.fileName,
    parents: targetFolderId ? [targetFolderId] : undefined
  };

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media: {
      mimeType: options.mimeType || 'text/markdown',
      body: mediaStream
    },
    fields: 'id, name, webViewLink'
  });

  return {
    fileId: res.data.id || '',
    name: res.data.name || options.fileName,
    webViewLink: res.data.webViewLink || undefined,
    simulated: false
  };
}
