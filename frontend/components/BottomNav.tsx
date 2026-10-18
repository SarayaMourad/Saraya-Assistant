"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BoxIcon, ChatIcon, GearIcon } from "./icons";

const items = [
  { href: "/stock", label: "Stock", Icon: BoxIcon },
  { href: "/assistant", label: "Assistant", Icon: ChatIcon },
  { href: "/settings", label: "Réglages", Icon: GearIcon }
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="mobile-bottom-nav" aria-label="Navigation principale">
      <div className="grid h-full grid-cols-3 gap-1">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`mobile-nav-link flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${active ? "text-saraya-primary" : "text-saraya-secondary"}`}
            >
              <Icon />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
