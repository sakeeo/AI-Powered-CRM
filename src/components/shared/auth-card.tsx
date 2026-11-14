import { BrainCircuit } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card className="py-2 sm:py-4">
      <CardHeader className="block px-6 sm:px-8">
        <div className="mb-5 flex flex-col items-center text-center" data-testid="auth-brand">
          <span
            aria-hidden
            className="bg-loud mb-3 grid size-12 place-items-center rounded-2xl text-white"
          >
            <BrainCircuit className="size-6" />
          </span>
          <strong className="text-2xl font-bold tracking-wide">Kerabat CRM</strong>
          <span className="text-muted-foreground text-sm">Pantau setiap lead hingga konversi.</span>
        </div>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardHeader>
      <CardContent className="[&_a]:text-loud space-y-5 px-6 sm:px-8 [&_a]:text-base [&_button]:h-12 [&_button]:text-base [&_input]:h-12 [&_input]:text-base [&_label]:text-base [&_p]:text-base">
        {children}
        {footer && <div className="text-muted-foreground text-center text-base">{footer}</div>}
      </CardContent>
    </Card>
  );
}
