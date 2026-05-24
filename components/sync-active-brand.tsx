"use client";
import { useEffect } from "react";

// Keeps the persisted "active brand" cookie aligned with the brand currently
// being viewed, so cookie-scoped surfaces (Projects, Review) stay correct even
// when the brand was reached via a deep link rather than the switcher.
export function SyncActiveBrand({ brandId }: { brandId: string }) {
  useEffect(() => {
    fetch(`/api/active-brand?id=${brandId}`, { method: "POST" }).catch(() => {});
  }, [brandId]);
  return null;
}
