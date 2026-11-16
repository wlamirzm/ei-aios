// ==============================================================================
// AG-018 TOOL: GOOGLE WORKSPACE & CLOUD DRIVE CONNECTOR
// ==============================================================================

import { Readable } from 'node:stream';
import { supabase } from '../config/supabase.js';
import { encryptSecret, decryptSecret } from '../config/crypto-vault.js';

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
  serviceAccountEmail?: string;
  defaultFolderId?: string;
  reportsFolderId?: string;
  status: 'connected' | 'unconfigured' | 'error';
  lastError?: string;
}

/**
 * Obtém uma instância autenticada da Google Drive API v3.
 * Prioriza credenciais de Service Account armazenadas criptografadas no banco (google_drive_configs)
 * ou variáveis de ambiente.
 */
export async function getDriveClient(): Promise<{ drive: any; email?: string } | null> {
  try {
    // 1. Tenta carregar credenciais do banco
    const { data: config } = await supabase
      .from('google_drive_configs')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let credentialsJson: any = null;

    if (config?.credentials_secret) {
      try {
        const decrypted = decryptSecret(config.credentials_secret);
        credentialsJson = JSON.parse(decrypted);
      } catch {
        // Formato plain fallback
        credentialsJson = JSON.parse(config.credentials_secret);
      }
    }

    // 2. Fallback para variável de ambiente se não estiver no banco
    if (!credentialsJson && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        credentialsJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      } catch {
        // ignore
      }
    }

    if (!credentialsJson || !credentialsJson.client_email || !credentialsJson.private_key) {
      return null;
    }

    const { google } = (await import('googleapis')) as any;
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
  } catch (error) {
    console.error('[AG-018] Erro ao instanciar cliente Google Drive:', error);
    return null;
  }
}

/**
 * Retorna o status de conexão do Google Drive
 */
export async function getDriveStatus(): Promise<DriveStatusResult> {
  try {
    const { data: config } = await supabase
      .from('google_drive_configs')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!config || !config.credentials_secret) {
      return {
        configured: false,
        authType: 'none',
        status: 'unconfigured'
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
 * Salva a configuração de Service Account criptografada
 */
export async function saveDriveServiceAccount(payload: {
  serviceAccountJson: string;
  defaultFolderId?: string;
  reportsFolderId?: string;
}): Promise<{ success: boolean; serviceAccountEmail: string }> {
  const parsed = JSON.parse(payload.serviceAccountJson);
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('O JSON fornecido não contém uma chave de Service Account válida (client_email e private_key são obrigatórios).');
  }

  const encrypted = encryptSecret(payload.serviceAccountJson);
  const email = parsed.client_email;

  // Atualiza ou insere na tabela google_drive_configs
  const { error } = await supabase
    .from('google_drive_configs')
    .insert({
      auth_type: 'service_account',
      service_account_email: email,
      credentials_secret: encrypted,
      default_folder_id: payload.defaultFolderId?.trim() || null,
      reports_folder_id: payload.reportsFolderId?.trim() || null,
      status: 'connected',
      last_synced_at: new Date().toISOString()
    });

  if (error) {
    throw new Error(`Falha ao persistir configuração do Google Drive: ${error.message}`);
  }

  return { success: true, serviceAccountEmail: email };
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
    // Quando ainda não configurado na VPS, retorna resposta simulada estruturada e didática
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

  const fileMetadata: any = {
    name: options.fileName,
    parents: options.parentFolderId ? [options.parentFolderId] : undefined
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
