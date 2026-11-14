import { Bot, SendHorizontal } from "lucide-react";

/** Ilustrasi statis fitur Tanya CRM (bukan data nyata) untuk hero landing page. */
export function ChatPreview() {
  const rows = [
    ["New Opportunity", "6"],
    ["Contacted", "2"],
    ["Negotiation", "3"],
  ];
  return (
    <figure
      aria-label="Contoh tampilan Tanya CRM"
      className="bg-card text-card-foreground shadow-popover mx-auto w-full max-w-md overflow-hidden rounded-md text-left"
    >
      <div className="bg-primary text-primary-foreground flex items-center gap-3 px-4 py-3">
        <span className="bg-primary-foreground/15 grid size-9 place-items-center rounded-full">
          <Bot className="size-5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Tanya CRM</p>
          <p className="text-primary-foreground/80 text-xs">jawaban dari data database</p>
        </div>
      </div>
      <div className="bg-secondary space-y-2 px-4 py-4 text-sm">
        <div className="flex justify-end">
          <p className="bg-tone-green-soft text-foreground max-w-[80%] rounded-xl rounded-tr-sm px-3 py-1.5 shadow-sm">
            Jumlah deal per stage
          </p>
        </div>
        <div className="bg-card max-w-[92%] rounded-xl rounded-tl-sm px-3 py-2 shadow-sm">
          <p className="font-semibold">Jumlah deal per stage</p>
          <p className="text-muted-foreground mb-2 text-xs">3 kelompok stage untuk deal</p>
          <table className="w-full overflow-hidden rounded-lg border text-xs">
            <thead>
              <tr className="bg-muted text-left">
                <th className="px-3 py-1.5 font-medium">Stage</th>
                <th className="px-3 py-1.5 font-medium">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([stage, n]) => (
                <tr key={stage} className="border-t">
                  <td className="px-3 py-1.5">{stage}</td>
                  <td className="px-3 py-1.5 tabular-nums">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-card flex items-center gap-2 border-t px-4 py-3">
        <span className="bg-secondary text-muted-foreground h-9 flex-1 rounded-3xl px-4 text-xs leading-9">
          Ketik pertanyaan, mis. Berapa deal Won bulan ini?
        </span>
        <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-full">
          <SendHorizontal className="size-4" />
        </span>
      </div>
      <figcaption className="text-muted-foreground border-t px-4 py-2 text-center text-[11px]">
        Contoh tampilan — angka hanya ilustrasi
      </figcaption>
    </figure>
  );
}
