// src/components/ui/SheetContext.ts
import { createContext, useContext } from "react";

/**
 * True for anything rendered inside a {@link Sheet}.
 *
 * Lives in its own module so a primitive like `NumberField` can ask the question without importing
 * `Sheet` itself — which pulls in a Modal, a PanResponder and an animation, and would put a small
 * leaf component downstream of a much larger one.
 *
 * **What it's for.** A keyboard accessory view (`NumberField`'s Done bar) is the right affordance
 * on a full screen, where the app's own background sits behind it and the whole stack reads as one
 * surface. Inside a sheet it is not: the sheet is lifted to sit on top of the keyboard, so an
 * accessory attached to the keyboard lands in the band *between* the two, and whatever it doesn't
 * paint shows the dimmed backdrop through it — the Done control ends up floating in a gap,
 * belonging to neither surface. Making the bar opaque only trades that for a hard-edged slab that
 * can't line its corners up with the keyboard's rounded ones, which is where this started — the
 * bar was made transparent precisely so it couldn't clash with a shape the OS is free to change.
 *
 * So a sheet owns its own chrome: it renders Done in its title row while the keyboard is up, and
 * `NumberField` suppresses its accessory when this is true. Nothing is left in the gap because
 * there is no gap — with no accessory, the sheet sits directly on the keypad.
 */
export const InsideSheetContext = createContext(false);

/** Whether the calling component is rendered inside a {@link Sheet}. */
export function useIsInsideSheet(): boolean {
  return useContext(InsideSheetContext);
}
