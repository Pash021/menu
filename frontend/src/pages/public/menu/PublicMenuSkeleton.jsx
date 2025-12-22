import React from "react";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import shared from "./styles/shared.module.css";
import styles from "./PublicMenuSkeleton.module.css";

export default function PublicMenuSkeleton() {
  return (
    <div className={styles.page}>
      <div className={shared.container}>
        <div className={styles.header}>
          <LoadingSkeleton className={styles.logo} />
          <LoadingSkeleton className={styles.title} />
          <LoadingSkeleton className={styles.subtitle} />
        </div>

        <div className={styles.pills}>
          {Array.from({ length: 7 }).map((_, i) => (
            <LoadingSkeleton key={i} className={styles.pill} />
          ))}
        </div>
      </div>
    </div>
  );
}

