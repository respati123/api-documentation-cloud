export type ErrorParams = Record<string, string>

export type MessageEntry = string | ((params: ErrorParams) => string)
