import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForecastChart } from "@/modules/intelligence/components/forecast-chart";
import type { ForecastResult } from "@/modules/intelligence/server/forecast";

const fmt = (v: number, cur: string) =>
  `${cur} ${new Intl.NumberFormat("id-ID").format(Math.round(v))}`;
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

/** Forecast probabilistik + backtest. Label estimasi selalu tampak. */
export function ForecastView({ result }: { result: ForecastResult }) {
  return (
    <div className="space-y-4" data-testid="forecast-view">
      <p
        className="bg-tone-orange-soft text-tone-orange-ink rounded-lg px-3 py-2 text-sm"
        data-testid="forecast-disclaimer"
      >
        <strong>Estimasi — bukan jaminan dan bukan angka akuntansi.</strong> Dihitung dari win rate
        historis dan perkiraan tanggal closing; angka resmi ada di Laporan.
      </p>
      {!result.ready ? (
        <Card>
          <CardHeader>
            <CardTitle>Data belum memadai</CardTitle>
            <CardDescription>
              Forecast ditampilkan setelah kualitas data memenuhi ambang minimum.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul
              className="text-muted-foreground list-disc pl-5 text-sm"
              data-testid="forecast-not-ready"
            >
              {result.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Rentang forecast {result.months.length} bulan ke depan</CardTitle>
                <CardDescription>
                  Deal terbuka ({result.total.deals} deal) dikelompokkan menurut bulan perkiraan
                  closing; {result.trials.toLocaleString("id-ID")} simulasi. Batang = P10–P90, titik
                  = P50.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ForecastChart data={result.months} currency={result.currency} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="forecast-table">
                  <thead className="text-muted-foreground text-left text-xs">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Bulan</th>
                      <th className="py-1 pr-3 font-medium">Deal</th>
                      <th className="py-1 pr-3 text-right font-medium">P10</th>
                      <th className="py-1 pr-3 text-right font-medium">P50</th>
                      <th className="py-1 pr-3 text-right font-medium">P90</th>
                      <th className="py-1 text-right font-medium">Nilai harapan</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {result.months.map((m) => (
                      <tr key={m.month} className="border-t">
                        <td className="py-1.5 pr-3">{m.month}</td>
                        <td className="py-1.5 pr-3">{m.deals}</td>
                        <td className="py-1.5 pr-3 text-right">{fmt(m.p10, result.currency)}</td>
                        <td className="py-1.5 pr-3 text-right">{fmt(m.p50, result.currency)}</td>
                        <td className="py-1.5 pr-3 text-right">{fmt(m.p90, result.currency)}</td>
                        <td className="py-1.5 text-right">{fmt(m.expected, result.currency)}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-semibold" data-testid="forecast-total">
                      <td className="py-1.5 pr-3">Total</td>
                      <td className="py-1.5 pr-3">{result.total.deals}</td>
                      <td className="py-1.5 pr-3 text-right">
                        {fmt(result.total.p10, result.currency)}
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        {fmt(result.total.p50, result.currency)}
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        {fmt(result.total.p90, result.currency)}
                      </td>
                      <td className="py-1.5 text-right">
                        {fmt(result.total.expected, result.currency)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-muted-foreground text-xs">
                Tidak diperkirakan: {result.excluded.noDate} deal tanpa tanggal closing,{" "}
                {result.excluded.beyondHorizon} di luar horizon, {result.excluded.otherCurrency}{" "}
                bermata uang lain. Deal yang melewati tanggal closing dihitung di bulan ini.
              </p>
            </CardContent>
          </Card>
          <Card data-testid="forecast-backtest">
            <CardHeader>
              <div>
                <CardTitle>Backtest</CardTitle>
                <CardDescription>
                  Metode yang sama dijalankan pada bulan-bulan lalu (hanya memakai data sebelum
                  bulan itu) lalu dibandingkan dengan hasil nyata.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.backtest.cases.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Belum ada bulan yang dapat di-backtest (butuh deal terbuka berperkiraan closing
                  pada bulan lalu dan riwayat tertutup sebelumnya).
                </p>
              ) : (
                <>
                  <p className="text-sm">
                    Cakupan P10–P90: <strong>{pct(result.backtest.coverage)}</strong> dari{" "}
                    {result.backtest.cases.length} bulan (ideal ≈ 80%) · Galat median P50 (MAPE):{" "}
                    <strong>{pct(result.backtest.mape)}</strong>
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-muted-foreground text-left text-xs">
                        <tr>
                          <th className="py-1 pr-3 font-medium">Bulan</th>
                          <th className="py-1 pr-3 font-medium">Deal</th>
                          <th className="py-1 pr-3 text-right font-medium">P10–P90</th>
                          <th className="py-1 pr-3 text-right font-medium">Aktual</th>
                          <th className="py-1 font-medium">Dalam rentang</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {result.backtest.cases.map((c) => (
                          <tr key={c.month} className="border-t">
                            <td className="py-1.5 pr-3">{c.month}</td>
                            <td className="py-1.5 pr-3">{c.deals}</td>
                            <td className="py-1.5 pr-3 text-right">
                              {fmt(c.p10, result.currency)} – {fmt(c.p90, result.currency)}
                            </td>
                            <td className="py-1.5 pr-3 text-right">
                              {fmt(c.actual, result.currency)}
                            </td>
                            <td className="py-1.5">{c.within ? "Ya" : "Tidak"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <p className="text-muted-foreground text-xs">
                Asumsi & batasan: docs/intelligence.md (§3.5).
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
