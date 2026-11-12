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
            className="bg-primary mb-3 grid size-12 place-items-center rounded-2xl text-white"
          >
            <BrainCircuit className="size-6" />
          </span>
          <strong className="text-lg font-bold tracking-wide">SMART CRM</strong>
          <span className="text-muted-foreground text-xs">
            AI Powered Customer Relation Management
          </span>
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-6 sm:px-8">
        {children}
        {footer && <div className="text-muted-foreground text-label text-center">{footer}</div>}
      </CardContent>
    </Card>
  );
}
