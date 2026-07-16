import { readFile } from "@/commands/fs"
import { normalizePath } from "@/lib/path-utils"

export function isResearchSchema(schema: string): boolean {
  if (/^#\s+Wiki Schema\s+[—-]\s+Research Deep-Dive\s*$/mi.test(schema)) return true
  return ["thesis", "methodology", "finding"].every((type) =>
    new RegExp(`^\\|\\s*${type}\\s*\\|`, "mi").test(schema),
  )
}

export async function isResearchProject(projectPath: string): Promise<boolean> {
  try {
    return isResearchSchema(await readFile(`${normalizePath(projectPath)}/schema.md`))
  } catch {
    return false
  }
}
