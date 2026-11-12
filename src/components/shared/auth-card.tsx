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
