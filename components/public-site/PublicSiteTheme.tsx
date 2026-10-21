"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isPublicSitePath } from "@/lib/public-site/routes";
import styles from "./PublicSiteTheme.module.css";

/** Never applies marketing styles to an authenticated portal or Studio. */
export default function PublicSiteTheme({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!isPublicSitePath(pathname)) return children;
  return <div data-public-site className={styles.site}>{children}</div>;
}
