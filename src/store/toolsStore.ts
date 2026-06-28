import { ToolDefinition } from '../types'

const KEY = 'webcraft_tools'

export function loadTools(): ToolDefinition[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveTool(tool: ToolDefinition): void {
  const tools = loadTools().filter((t) => t.id !== tool.id)
  localStorage.setItem(KEY, JSON.stringify([...tools, tool]))
}

export function deleteTool(id: string): void {
  const tools = loadTools().filter((t) => t.id !== id)
  localStorage.setItem(KEY, JSON.stringify(tools))
  // 一併清除該工具自己的 bridge.storage 資料
  localStorage.removeItem(`webcraft_toolstore_${id}`)
}

export function getTool(id: string): ToolDefinition | undefined {
  return loadTools().find((t) => t.id === id)
}
