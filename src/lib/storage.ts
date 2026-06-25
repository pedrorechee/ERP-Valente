import { createServiceClient } from './supabase/service'

type Bucket = 'obra-fotos' | 'obra-documentos' | 'obra-comprovantes' | 'company-assets'

export async function uploadFile(
  bucket: Bucket,
  path: string,
  file: File
): Promise<string> {
  const service = createServiceClient()
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const { error } = await service.storage
    .from(bucket)
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (error) throw new Error(`Upload falhou: ${error.message}`)
  return path
}

export async function getSignedUrl(
  bucket: Bucket,
  path: string,
  expiresIn = 3600
): Promise<string> {
  const service = createServiceClient()
  const { data, error } = await service.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  if (error || !data) throw new Error('Erro ao gerar URL do arquivo')
  return data.signedUrl
}

export async function deleteFile(bucket: Bucket, path: string): Promise<void> {
  const service = createServiceClient()
  await service.storage.from(bucket).remove([path])
}

// URL pública (para buckets públicos, ex.: company-assets — logo em sidebar/PDF)
export function getPublicUrl(bucket: Bucket, path: string): string {
  const service = createServiceClient()
  return service.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export function buildPath(parts: string[]): string {
  const sanitized = parts.map((p) =>
    p.replace(/[^a-zA-Z0-9._\-]/g, '-').replace(/-+/g, '-')
  )
  return sanitized.join('/')
}
