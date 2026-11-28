"use client";

/**
 * Browser translation (Chrome/Google Translate, Safari, Edge) replaces text
 * nodes inside the page. React still holds the original nodes, so a later
 * update can throw "Failed to execute 'removeChild' on 'Node'" and blank the
 * page — a long-standing React issue (facebook/react#11538). Instead of
 * crashing, skip removals of nodes that were moved, and append inserts whose
 * reference node is gone. Only these failure cases change; everything else
 * goes through the original methods.
 */
type Patched = typeof Node.prototype & { __translationGuard?: true };

if (typeof window !== "undefined" && typeof Node === "function") {
  const proto = Node.prototype as Patched;
  if (!proto.__translationGuard) {
    proto.__translationGuard = true;

    const removeChild = proto.removeChild;
    proto.removeChild = function <T extends Node>(this: Node, child: T): T {
      if (child.parentNode !== this) {
        console.warn("[translation-guard] skipped removing a node moved by page translation");
        return child;
      }
      return removeChild.call(this, child) as T;
    };

    const insertBefore = proto.insertBefore;
    proto.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
      if (ref && ref.parentNode !== this) {
        console.warn("[translation-guard] reference node moved by page translation; appending instead");
        return insertBefore.call(this, node, null) as T;
      }
      return insertBefore.call(this, node, ref) as T;
    };
  }
}

export function TranslationGuard() {
  return null;
}
