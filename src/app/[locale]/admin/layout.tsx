import { Suspense } from "react";
import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { Icon } from "@/components/icons";
import { AdminNav, type AdminNavItem } from "./admin-nav";

/** Same tabs without the active state: the static fallback while the pathname is resolved. */
function StaticAdminNav({ items }: { items: AdminNavItem[] }) {
  return (
    <nav aria-label="Admin" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-1 rounded-full bg-surface-2 p-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium text-muted"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Static shell for the admin console; every page re-checks admin + 2FA itself. */
export default async function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const n = dict.console.nav;
  const base = `/${locale}/admin`;
  const items: AdminNavItem[] = [
    { href: base, label: n.overview, exact: true },
    { href: `${base}/questions`, label: n.questions },
    { href: `${base}/responders`, label: n.responders },
    { href: `${base}/reviews`, label: n.reviews },
    { href: `${base}/finance`, label: n.finance },
    { href: `${base}/community`, label: n.community },
    { href: `${base}/settings`, label: n.settings },
    { href: `${base}/audit`, label: n.audit },
  ];
  return (
    <div className="admin-wide space-y-6">
      <p className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">
        <Icon name="shield" className="size-3.5 text-accent" />
        {dict.console.strip}
      </p>
      <Suspense fallback={<StaticAdminNav items={items} />}>
        <AdminNav items={items} />
      </Suspense>
      {children}
    </div>
  );
}
