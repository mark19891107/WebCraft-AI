import { useState, useCallback } from 'react'
import { ToolDefinition } from '../types'
import { loadTools, saveTool, deleteTool, getTool } from '../store/toolsStore'

export function useTools() {
  const [tools, setTools] = useState<ToolDefinition[]>(() => loadTools())

  const refresh = useCallback(() => setTools(loadTools()), [])

  const save = useCallback((tool: ToolDefinition) => {
    saveTool(tool)
    setTools(loadTools())
  }, [])

  const remove = useCallback((id: string) => {
    deleteTool(id)
    setTools(loadTools())
  }, [])

  return { tools, refresh, save, remove, getTool }
}
