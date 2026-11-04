"use client";

import type React from "react";

/**
 * Defensive pointer capture.
 *
 * `setPointerCapture` throws NotFoundError when the pointerId has no active
 * pointer — automation (synthetic PointerEvents), exotic touch flows and
 * released-pointer races can all hit it. Throwing here would abort the rest
 * of the pointerdown handler (state setup, preventDefault), so we swallow
 * the error: without a capture the event stream still works via normal
 * bubbling, only window-outside-up safety is lost.
 */
export function capturePointer(e: React.PointerEvent): void {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    // pointer already gone — keep going without the capture
  }
}
