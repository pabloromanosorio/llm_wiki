import { describe, expect, it } from "vitest"
import { isResearchSchema } from "./project-profile"

describe("project profile detection", () => {
  it("recognizes current and pre-v2 Research schemas without mutating them", () => {
    expect(isResearchSchema("# Wiki Schema — Research Deep-Dive\n\n| repository | wiki/repositories/ |")).toBe(true)
    expect(isResearchSchema([
      "# Wiki Schema",
      "| thesis | wiki/thesis/ | hypothesis |",
      "| methodology | wiki/methodology/ | methods |",
      "| finding | wiki/findings/ | results |",
    ].join("\n"))).toBe(true)
  })

  it("does not route General schemas through Research screening", () => {
    expect(isResearchSchema("# Wiki Schema\n\n| source | wiki/sources/ | Sources |")).toBe(false)
  })
})
