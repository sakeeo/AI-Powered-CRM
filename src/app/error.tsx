"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-lg font-semibold">Terjadi kesalahan</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Maaf, ada yang tidak berjalan semestinya.{error.digest ? ` Kode: ${error.digest}` : ""}
      </p>
      <Button onClick={reset}>Coba lagi</Button>
    </div>
  );
}
