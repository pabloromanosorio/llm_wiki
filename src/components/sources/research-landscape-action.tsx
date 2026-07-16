import { useState } from "react"
import { Loader2, Map } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { buildResearchLandscape } from "@/lib/corpus-bootstrap"
import type { LlmConfig } from "@/stores/wiki-store"
import type { WikiProject } from "@/types/wiki"

interface ResearchLandscapeActionProps {
  project: WikiProject
  llmConfig: LlmConfig
}

export function ResearchLandscapeAction({
  project,
  llmConfig,
}: ResearchLandscapeActionProps) {
  const { t } = useTranslation()
  const [refreshing, setRefreshing] = useState(false)
  const [updatedCount, setUpdatedCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refreshLandscape() {
    if (refreshing) return
    setRefreshing(true)
    setUpdatedCount(null)
    setError(null)
    try {
      const result = await buildResearchLandscape(project, llmConfig)
      setUpdatedCount(result.writtenPaths.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-muted/10 px-4 py-3">
      <div className="mr-auto">
        <div className="text-sm font-semibold">{t("sources.landscape.title")}</div>
        <p className="text-xs text-muted-foreground">
          {t("sources.landscape.description")}
        </p>
      </div>
      {updatedCount !== null && (
        <span className="text-xs text-muted-foreground">
          {t("sources.landscape.complete", { count: updatedCount })}
        </span>
      )}
      {error && (
        <span className="max-w-80 text-xs text-destructive">
          {t("sources.landscape.error", { error })}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={refreshing}
        onClick={() => void refreshLandscape()}
      >
        {refreshing
          ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          : <Map className="mr-1.5 h-3.5 w-3.5" />}
        {refreshing
          ? t("sources.landscape.refreshing")
          : t("sources.landscape.build")}
      </Button>
    </div>
  )
}
