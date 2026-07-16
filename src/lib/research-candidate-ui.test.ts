import { describe, expect, it } from "vitest"
import en from "@/i18n/en.json"
import zh from "@/i18n/zh.json"

describe("Research candidate UI contract", () => {
  it("exposes screening, batch decisions, queue handoff, and the explicit bypass", () => {
    expect(en.sources.importAndIngestNow).toBe("Import and ingest now")
    expect(en.sources.candidates).toMatchObject({
      selectAll: "Select all",
      screen: "Screen",
      include: "Include",
      watch: "Watch",
      exclude: "Exclude",
      queueIncluded: "Queue included ({{count}})",
    })
    expect(zh.sources.candidates.include).toBe("纳入")
  })

  it("exposes the bounded Research landscape action and completion state", () => {
    expect(en.sources.landscape).toMatchObject({
      title: "Research landscape",
      build: "Build landscape",
      refreshing: "Refreshing landscape...",
      complete: "Updated {{count}} landscape pages.",
    })
    expect(zh.sources.landscape.build).toBe("构建研究全景")
  })
})
