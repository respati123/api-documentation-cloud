import type { TreeNode, WorkspaceVariable, WorkspaceVariables } from '@/models/workspace'

export function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value ?? fallback) as T
  try { return JSON.parse(value) as T } catch { return fallback }
}

export function emptyWorkspaceVariables(): WorkspaceVariables { return { globals: [], environments: [] } }

export function sanitizeWorkspaceVariables(value: WorkspaceVariables): WorkspaceVariables {
  const cleanRows = (rows: WorkspaceVariable[]) => rows.map(({ id, name, value: variableValue, secret }) => ({ id, name, value: variableValue, secret }))
  return {
    globals: cleanRows(value.globals),
    environments: value.environments.map(({ id, name, variables }) => ({ id, name, variables: cleanRows(variables) }))
  }
}

export function validateWorkspaceVariables(value: unknown): value is WorkspaceVariables {
  if (!isRecord(value) || !Array.isArray(value.globals) || !Array.isArray(value.environments) || value.globals.length > 500 || value.environments.length > 100) return false
  const ids = new Set<string>()
  let count = 0
  function validVariable(item: unknown): item is WorkspaceVariable {
    if (!isRecord(item) || ++count > 2000 || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.name !== 'string' || item.name.length > 160 || typeof item.value !== 'string' || item.value.length > 65536 || typeof item.secret !== 'boolean') return false
    if (item.secret && item.value !== '') return false
    ids.add(item.id)
    return true
  }
  if (!value.globals.every(validVariable)) return false
  return value.environments.every((item) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100 || !Array.isArray(item.variables) || item.variables.length > 500) return false
    ids.add(item.id)
    return item.variables.every(validVariable)
  })
}

export function parseSnapshot(value: unknown): { tree: TreeNode[]; variables: WorkspaceVariables } {
  if (Array.isArray(value)) return { tree: value as TreeNode[], variables: emptyWorkspaceVariables() }
  if (!isRecord(value) || !validateTree(value.tree)) return { tree: [], variables: emptyWorkspaceVariables() }
  const variables = value.variables === undefined ? emptyWorkspaceVariables() : value.variables
  return validateWorkspaceVariables(variables) ? { tree: value.tree, variables: sanitizeWorkspaceVariables(variables) } : { tree: value.tree, variables: emptyWorkspaceVariables() }
}

export function validateTree(value: unknown): value is TreeNode[] {
  if (!Array.isArray(value) || value.length > 1000) return false
  let count = 0
  const ids = new Set<string>()
  function valid(node: unknown, depth: number): node is TreeNode {
    if (!isRecord(node) || depth > 30 || ++count > 10000 || typeof node.id !== 'string' || ids.has(node.id) || typeof node.name !== 'string' || node.name.trim().length > 160) return false
    ids.add(node.id)
    if (node.kind === 'folder') return Array.isArray(node.children) && node.children.length <= 1000 && node.children.every((child) => valid(child, depth + 1))
    if (node.kind !== 'request' || typeof node.method !== 'string' || typeof node.url !== 'string' || typeof node.body !== 'string') return false
    if (node.documentation !== undefined && (typeof node.documentation !== 'string' || node.documentation.length > 100000)) return false
    if (node.deprecated !== undefined && typeof node.deprecated !== 'boolean') return false
    if (node.deprecationReason !== undefined && (typeof node.deprecationReason !== 'string' || node.deprecationReason.length > 4096)) return false
    if (node.bodyMode !== undefined && !['form-data', 'urlencoded', 'graphql', 'json', 'xml', 'yaml', 'edn', 'text', 'other', 'file', 'none'].includes(String(node.bodyMode))) return false
    if (node.bodyPath !== undefined) return false
    if (node.headers !== undefined && (!Array.isArray(node.headers) || node.headers.length > 100 || !node.headers.every((header) => {
      if (!isRecord(header)) return false
      return typeof header.id === 'string' && typeof header.name === 'string' && header.name.length <= 8192 && typeof header.value === 'string' && header.value.length <= 65536 && typeof header.enabled === 'boolean' && (header.description === undefined || typeof header.description === 'string' && header.description.length <= 4096)
    }))) return false
    if (node.params !== undefined && (!Array.isArray(node.params) || node.params.length > 100 || !node.params.every((param) => {
      if (!isRecord(param)) return false
      return typeof param.id === 'string' && typeof param.name === 'string' && typeof param.value === 'string' && typeof param.enabled === 'boolean' && (param.description === undefined || typeof param.description === 'string' && param.description.length <= 4096)
    }))) return false
    if (node.auth !== undefined) {
      if (!isRecord(node.auth)) return false
      const auth = node.auth
      const validAuth = auth.type === 'none'
        || auth.type === 'bearer' && typeof auth.token === 'string'
        || auth.type === 'basic' && typeof auth.username === 'string' && typeof auth.password === 'string'
        || auth.type === 'api-key' && typeof auth.name === 'string' && typeof auth.value === 'string' && (auth.location === 'header' || auth.location === 'query')
      if (!validAuth) return false
    }
    if (node.bodyFields !== undefined && (!Array.isArray(node.bodyFields) || node.bodyFields.length > 100 || !node.bodyFields.every((field) => {
      if (!isRecord(field)) return false
      return typeof field.id === 'string' && typeof field.name === 'string' && typeof field.value === 'string' && typeof field.enabled === 'boolean' && (field.type === 'text' || field.type === 'file') && field.filePath === undefined && (field.fileName === undefined || typeof field.fileName === 'string')
    }))) return false
    return ['bodyVariables', 'bodyMimeType', 'bodyPath', 'bodyFileName'].every((key) => node[key] === undefined || typeof node[key] === 'string')
  }
  return value.every((node) => valid(node, 0))
}
