"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./mobile-navigation.module.css";

const destinations = [
  { href: "/", path: "/", label: "Home" },
  { href: "/projects", path: "/projects", label: "Projects" },
  { href: "/account?mode=signin", path: "/account", label: "Account" },
];

export function MobileNavigation() {
  const pathname = usePathname();
  return <nav className={styles.navigation} aria-label="Mobile navigation">
    {destinations.map(({ href, path, label }) => <Link key={path} href={href} className={styles.link}
      aria-current={pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)) ? "page" : undefined}>
      {label}
    </Link>)}
    <div className={styles.safeArea} aria-hidden="true" />
  </nav>;
}
