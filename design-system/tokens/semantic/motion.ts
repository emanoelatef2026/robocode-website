/**
 * Semantic Tokens — Motion. Assigns Primitive duration/easing to the four
 * Motion tiers (DSA §14.3). `celebratory` is the only tier this token set
 * marks as domain-restricted — enforcement (Learning Record only, never
 * Finance/Governance) is a Quality Checklist item (DSA §18.7), not
 * something a token can gate by itself.
 */
import { PRIMITIVE_MOTION } from "../primitive/motion";
import type { MotionTierKey } from "../../foundation/motion";

export interface MotionStyle {
  duration: string;
  easing: string;
}

export const SEMANTIC_MOTION: Record<MotionTierKey, MotionStyle> = {
  "state-change": { duration: PRIMITIVE_MOTION.duration.fast, easing: PRIMITIVE_MOTION.easing.standard },
  component: { duration: PRIMITIVE_MOTION.duration.base, easing: PRIMITIVE_MOTION.easing.standard },
  page: { duration: PRIMITIVE_MOTION.duration.slow, easing: PRIMITIVE_MOTION.easing.decelerate },
  celebratory: { duration: PRIMITIVE_MOTION.duration.slower, easing: PRIMITIVE_MOTION.easing.spring },
};
