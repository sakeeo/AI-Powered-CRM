import type { Metadata } from "next";
import { Forbidden } from "@/components/shared/forbidden";
import { requireTenant } from "@/lib/context";
import { ForecastView } from "@/modules/intelligence/components/forecast-view";
import { getForecast } from "@/modules/intelligence/server/forecast";

export const metadata: Metadata = { title: "Forecast penjualan" };

export default async function Page() {
  const ctx = await requireTenant();
  if (!ctx.ability.can("view", "Report") || !ctx.ability.can("view", "Deal"))
    return <Forbidden what="halaman Forecast" />;
  return <ForecastView result={await getForecast(ctx)} />;
}
