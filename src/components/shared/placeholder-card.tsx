import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Kartu slot untuk bagian yang diisi modul lain (related deals, timeline). */
export function PlaceholderCard({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader className="block">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-label">Belum ada data.</p>
      </CardContent>
    </Card>
  );
}
