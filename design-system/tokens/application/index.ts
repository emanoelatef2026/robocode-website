/**
 * Application Tokens — DSA §5.5.
 *
 * A portal/persona-scoped override layer sitting between Semantic and
 * Theme. Formalizes the density-to-persona mapping DSA §9.3 already fixes
 * as a permanent ruling — this file transcribes that table, it does not
 * decide it. Per DSA §5.5, this layer "should be built out as the
 * Component Taxonomy matures, not retrofitted all at once" — density is
 * the one dimension needed today because it's a Foundation-category
 * concern; further per-portal overrides (e.g. Application color tokens)
 * are added only when a Component genuinely needs one.
 */
import type { PortalKey } from "../types";
import type { DensityKey } from "../../foundation/density";

export interface ApplicationDensityToken {
  /** DSA §9.3 — the default density for this portal's operational surfaces. */
  default: DensityKey;
  /** DSA §9.3 — the density used for this portal's analytical/bulk surfaces, if distinct. */
  analytical?: DensityKey;
}

/** DSA §9.3 Density-to-breakpoint-to-persona mapping, transcribed verbatim. */
export const APPLICATION_DENSITY: Record<PortalKey, ApplicationDensityToken> = {
  admin: { default: "comfortable", analytical: "dense" },
  teamLeader: { default: "comfortable" },
  instructor: { default: "touch" },
  parent: { default: "compact" },
  student: { default: "touch" },
  studio: { default: "comfortable" },
  public: { default: "comfortable" },
};
