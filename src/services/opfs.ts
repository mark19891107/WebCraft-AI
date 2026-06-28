// 所有路徑相對於 OPFS 根目錄，例如 "/data/sales.csv"

export function isOPFSSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory
}

async function getFileHandle(path: string, create: boolean): Promise<FileSystemFileHandle> {
  const root = await navigator.storage.getDirectory()
  const parts = path.replace(/^\//, '').split('/')
  let dir: FileSystemDirectoryHandle = root
  for (const part of parts.slice(0, -1)) {
    dir = await dir.getDirectoryHandle(part, { create })
  }
  return dir.getFileHandle(parts[parts.length - 1], { create })
}

export async function writeFile(path: string, data: File | Blob): Promise<void> {
  const handle = await getFileHandle(path, true)
  const writable = await handle.createWritable()
  await writable.write(data)
  await writable.close()
}

export async function readFileAsText(path: string): Promise<string> {
  const handle = await getFileHandle(path, false)
  const file = await handle.getFile()
  return file.text()
}

// 只讀取檔案開頭一段（供預覽，避免讀進整個大檔）
export async function readFilePrefix(path: string, maxBytes = 65536): Promise<string> {
  const handle = await getFileHandle(path, false)
  const file = await handle.getFile()
  return file.slice(0, maxBytes).text()
}

export async function getFileSize(path: string): Promise<number> {
  const handle = await getFileHandle(path, false)
  const file = await handle.getFile()
  return file.size
}

export async function deleteFile(path: string): Promise<void> {
  const root = await navigator.storage.getDirectory()
  const parts = path.replace(/^\//, '').split('/')
  let dir: FileSystemDirectoryHandle = root
  for (const part of parts.slice(0, -1)) {
    dir = await dir.getDirectoryHandle(part, { create: false })
  }
  await dir.removeEntry(parts[parts.length - 1])
}

export interface OPFSFileInfo {
  path: string
  name: string
  size: number
}

export async function listFiles(directory = '/data'): Promise<OPFSFileInfo[]> {
  if (!isOPFSSupported()) return []
  const root = await navigator.storage.getDirectory()
  const parts = directory.replace(/^\//, '').split('/').filter(Boolean)
  let dir: FileSystemDirectoryHandle = root
  for (const part of parts) {
    try {
      dir = await dir.getDirectoryHandle(part, { create: false })
    } catch {
      return []
    }
  }
  const results: OPFSFileInfo[] = []
  // @ts-expect-error - FileSystemDirectoryHandle async iterator 尚未在所有 TS lib 中
  for await (const [name, handle] of dir) {
    if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile()
      results.push({ path: `${directory}/${name}`, name, size: file.size })
    }
  }
  return results
}
