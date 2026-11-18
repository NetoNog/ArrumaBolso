import { describe, expect, it } from "vitest";

import { AVATAR_STYLES, initials, isAvatarStyle, randomSeeds, renderAvatar } from "@/lib/avatar";
import { emptyState } from "@/lib/data/initial-state";
import { parseFinanceState } from "@/lib/data/repository";

describe("avatar", () => {
  it("renders every offered style as an SVG data URI, deterministically per seed", async () => {
    for (const style of AVATAR_STYLES) {
      const first = await renderAvatar(style.id, "Zé");
      expect(first.startsWith("data:image/svg+xml")).toBe(true);
      expect(await renderAvatar(style.id, "Zé")).toBe(first);
      expect(await renderAvatar(style.id, "Maria")).not.toBe(first);
    }
  });

  it("only accepts known styles", () => {
    expect(isAvatarStyle("lorelei")).toBe(true);
    expect(isAvatarStyle("adventurer")).toBe(false); // CC BY: needs attribution, not offered
    expect(isAvatarStyle(null)).toBe(false);
  });

  it("derives initials and random seeds", () => {
    expect(initials("josé nogueira")).toBe("JN");
    expect(initials("   ")).toBe("A");
    const seeds = randomSeeds(5);
    expect(new Set(seeds).size).toBe(5);
  });

  it("restores backups made before profile pictures existed", () => {
    const json = JSON.parse(JSON.stringify(emptyState()));
    delete json.settings.avatar_style;
    delete json.settings.avatar_seed;
    expect(parseFinanceState(json)?.settings).toMatchObject({ avatar_style: null, avatar_seed: null });
  });
});
