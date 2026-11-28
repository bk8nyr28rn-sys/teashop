import { Fragment, type ReactNode } from "react";

/**
 * A member's nickname. Marked `translate="no"` so browser translation doesn't
 * turn "river_fox" into "河狐", and isolated (<bdi>) so it renders correctly
 * next to right-to-left text.
 */
export function Handle({ children }: { children: ReactNode }) {
  return <bdi translate="no">@{children}</bdi>;
}

/** Text that must stay exactly as written (codes, names). */
export function NoTranslate({ children }: { children: ReactNode }) {
  return <bdi translate="no">{children}</bdi>;
}

/** Like `format()`, but values may be elements, e.g. a nickname that must not be translated. */
export function formatRich(template: string, values: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={i}>{key && key in values ? values[key] : part}</Fragment>;
  });
}
