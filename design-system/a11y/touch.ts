/**
 * Touch-target helpers — DSA §13 "Touch". 44×44px minimum, enforced via
 * the Touch density token (DSA §9), not a per-screen check.
 */
import { MIN_TOUCH_TARGET_PX } from "../foundation/sizing";

export { MIN_TOUCH_TARGET_PX };

export function meetsMinimumTouchTarget(widthPx: number, heightPx: number): boolean {
  return widthPx >= MIN_TOUCH_TARGET_PX && heightPx >= MIN_TOUCH_TARGET_PX;
}
