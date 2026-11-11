"use client";

import { createMongoAbility, type RawRuleOf } from "@casl/ability";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Action, AppAbility, SubjectName } from "@/lib/abilities";

const Ctx = createContext<AppAbility | null>(null);

/**
 * Menyalurkan ability dari server ke UI. HANYA untuk menyembunyikan aksi —
 * penegakan izin yang sebenarnya selalu di server (assertCan/scopeWhere).
 */
export function AbilityProvider({
  rules,
  children,
}: {
  rules: RawRuleOf<AppAbility>[];
  children: ReactNode;
}) {
  const ability = useMemo(() => createMongoAbility(rules) as AppAbility, [rules]);
  return <Ctx.Provider value={ability}>{children}</Ctx.Provider>;
}

export function useCan() {
  const ability = useContext(Ctx);
  return (action: Action, subject: SubjectName, record?: object) => {
    if (!ability) return false;
    if (!record) return ability.can(action, subject);
    return ability.can(
      action,
      Object.assign({}, record, { __caslSubjectType__: subject }) as never,
    );
  };
}
