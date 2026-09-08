import { useEffect, useRef, type RefObject } from "react";

/** Cache tab stops until the dialog changes; never measure every button per Tab. */
export function useModalFocusTrap(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const background = new Map<HTMLElement, boolean>();
    for (let node: HTMLElement | null = dialog; node?.parentElement; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling !== node && sibling instanceof HTMLElement) {
          background.set(sibling, sibling.inert);
          sibling.inert = true;
        }
      }
    }
    let dirty = true;
    let stops: HTMLElement[] = [];
    const observer = new MutationObserver(() => { dirty = true; });
    observer.observe(dialog, { childList: true, subtree: true, attributes: true,
      attributeFilter: ["disabled", "hidden", "tabindex", "class", "inert"] });
    const refresh = () => {
      if (observer.takeRecords().length) dirty = true;
      if (!dirty) return;
      stops = Array.from(dialog.querySelectorAll<HTMLElement>("button,input,select,textarea,a[href],[tabindex]"))
        .filter(el => el.tabIndex >= 0 && !el.matches(":disabled") && !el.closest("[hidden],[inert]") && el.getClientRects().length > 0);
      dirty = false;
    };
    refresh();
    (stops[0] ?? dialog).focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close.current(); return; }
      if (event.key !== "Tab") return;
      refresh();
      const first = stops[0] ?? dialog;
      const last = stops.at(-1) ?? dialog;
      const active = document.activeElement;
      if (!dialog.contains(active) || active === dialog || !stops.length) {
        event.preventDefault(); first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault(); first.focus();
      }
    };
    const resize = () => { dirty = true; };
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", resize);
      for (const [element, inert] of background) element.inert = inert;
      if (opener?.isConnected) opener.focus();
    };
  }, [ref]);
}
