"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthGate from "./AuthGate";
import BottomNav from "./BottomNav";
import { BoxIcon, ChatIcon, GearIcon, CoffeeIcon } from "./icons";

const nav = [
  { href: "/stock", label: "Stock", Icon: BoxIcon },
  { href: "/assistant", label: "Assistant", Icon: ChatIcon },
  { href: "/settings", label: "Réglages", Icon: GearIcon }
];

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AuthGate>
      <div className="premium-shell fade-in">
        <aside className="desktop-sidebar">
          <div className="brand-lockup"><span className="brand-mark"><CoffeeIcon /></span><div><b>Saraya</b><small>Assistant privé</small></div></div>
          <nav className="side-nav">
            {nav.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return <Link key={href} href={href} className={`side-link ${active ? "active" : ""}`}><Icon /><span>{label}</span></Link>;
            })}
          </nav>
          <div className="sidebar-foot"><span className="status-dot" /> Système opérationnel</div>
        </aside>
        <div className="app-shell"><main className="safe-bottom">{children}</main><BottomNav /></div>
      </div>
    </AuthGate>
  );
}
