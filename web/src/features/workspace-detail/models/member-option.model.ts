import * as z from 'zod/mini'

export const memberOptionSchema = z.object({ id: z.string(), email: z.string() })
export type MemberOption = z.infer<typeof memberOptionSchema>
