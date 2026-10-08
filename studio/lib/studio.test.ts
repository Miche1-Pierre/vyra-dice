import { readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { slugify } from "@studio/lib/brief"
import { appendLesson, safeFileName } from "@studio/lib/clubs"
import { workBranchName } from "@studio/lib/git"
import { withoutLocalPaths, withoutLocalPathsDeep } from "@studio/lib/local-paths"
import { clubPaths, insideClub, REPO } from "@studio/lib/paths"
import { identifierOf, publishClub, registerClub, registrationOf } from "@studio/lib/registry-file"

describe("work branches", () => {
  it("names the Studio's branches after the club or the Linear issue, never main", () => {
    const at = new Date("2026-10-08T14:42:00Z")
    expect(workBranchName("lumen-club", undefined, at)).toBe("studio/lumen-club-20261008-1442")
    expect(workBranchName("809-social-club", "VYR-59")).toBe("feat/VYR-59-809-social-club")
  })
})

describe("local paths in the versioned history", () => {
  it("names repo files relative to the repo and the home folder as ~", () => {
    const script = path.join(REPO, "art", "scripts", "build_club.py")
    expect(withoutLocalPaths(`${script}:948: DeprecationWarning`)).toBe(
      `${path.join("art", "scripts", "build_club.py")}:948: DeprecationWarning`,
    )
    expect(withoutLocalPaths(`${REPO.replace(/\\/g, "/")}/clubs/naho`)).toBe("clubs/naho")
    expect(withoutLocalPaths(path.join(os.homedir(), "tmp", "x.png"))).toBe(
      `~${path.sep}${path.join("tmp", "x.png")}`,
    )
    // tools print paths relative to the repo: the home folder seen from there
    const fromRepo = path.relative(REPO, path.join(os.homedir(), "tmp"))
    if (fromRepo.startsWith("..")) expect(withoutLocalPaths(fromRepo)).toBe(`~${path.sep}tmp`)
  })

  it("cleans every string of a run status", () => {
    const status = { result: { worktree: path.join(os.homedir(), "w"), turns: 3 }, tags: [REPO] }
    expect(withoutLocalPathsDeep(status)).toEqual({
      result: { worktree: `~${path.sep}w`, turns: 3 },
      tags: [""],
    })
  })
})

describe("slugify", () => {
  it("makes URL and folder names from club names", () => {
    expect(slugify("809 Social Club")).toBe("809-social-club")
    expect(slugify("Le Café Électrique !")).toBe("le-cafe-electrique")
    expect(slugify("  NAHO  ")).toBe("naho")
  })
})

describe("club paths", () => {
  it("refuses slugs that are not slugs", () => {
    expect(() => clubPaths("../etc")).toThrow()
    expect(() => clubPaths("Naho")).toThrow()
  })

  it("keeps file access inside the club folder", () => {
    expect(insideClub("naho", "build/previews/top.png")).toMatch(
      /clubs[\\/]naho[\\/]build[\\/]previews[\\/]top\.png$/,
    )
    expect(() => insideClub("naho", "../registry.ts")).toThrow(/Outside/)
    expect(() => insideClub("naho", "../../package.json")).toThrow(/Outside/)
  })
})

describe("safeFileName", () => {
  it("keeps uploads to plain names", () => {
    expect(safeFileName("../../Photo bar été.JPG")).toBe("Photo-bar-ete.JPG")
    expect(safeFileName("C:\\Users\\x\\plan (1).pdf")).toBe("plan-1-.pdf")
  })
})

describe("registerClub", () => {
  const registry = readFileSync("clubs/registry.ts", "utf8")

  it("names the import after the slug", () => {
    expect(identifierOf("naho")).toBe("naho")
    expect(identifierOf("lumen-club")).toBe("lumenClub")
    expect(identifierOf("809-social-club")).toBe("club809SocialClub")
  })

  it("adds a generated club to the drafts: one import, in slug order, only once", () => {
    const once = registerClub("809-social-club", registry)
    expect(once).toContain(`import club809SocialClub from "./809-social-club"`)
    expect(once.indexOf("./809-social-club")).toBeLessThan(once.indexOf("./naho"))
    expect(once).toMatch(/drafts: readonly ClubDefinition\[\] = \[[^\]]*club809SocialClub\]/)
    expect(registrationOf("809-social-club", once)).toBe("draft")
    expect(registerClub("809-social-club", once)).toBe(once)
  })

  it("publishes a draft by moving it to the served clubs, only once", () => {
    const published = publishClub("809-social-club", registerClub("809-social-club", registry))
    expect(registrationOf("809-social-club", published)).toBe("published")
    expect(published).toMatch(/clubs: readonly ClubDefinition\[\] = \[[^\]]*club809SocialClub\]/)
    expect(published).not.toMatch(/drafts: readonly ClubDefinition\[\] = \[[^\]]*club809Social/)
    expect(publishClub("809-social-club", published)).toBe(published)
  })

  it("leaves a published club where it is", () => {
    expect(registrationOf("naho", registry)).toBe("published")
    expect(registerClub("naho", registry)).toBe(registry)
  })
})

describe("appendLesson", () => {
  const naho = "## Naho Club (La Garde) — 2026-10-07"
  const lumen = "## Lumen Club (Toulon) — 2026-10-08"
  const guide = `# Leçons\n\nIntro.\n\n${naho}\n\n- **A** : a.\n`

  it("opens the club's section at the end of the guide", () => {
    expect(appendLesson(guide, lumen, "- **B** : b.")).toBe(`${guide}\n${lumen}\n\n- **B** : b.\n`)
  })

  it("keeps a club's lessons in the order they were accepted", () => {
    const two = appendLesson(appendLesson(guide, lumen, "- **B** : b."), lumen, "- **C** : c.")
    expect(two).toBe(`${guide}\n${lumen}\n\n- **B** : b.\n- **C** : c.\n`)
  })

  it("adds to a section that is not the last one", () => {
    const later = `${guide}\n${lumen}\n\n- **B** : b.\n`
    expect(appendLesson(later, naho, "- **Z** : z.")).toBe(
      `# Leçons\n\nIntro.\n\n${naho}\n\n- **A** : a.\n- **Z** : z.\n\n${lumen}\n\n- **B** : b.\n`,
    )
  })
})
