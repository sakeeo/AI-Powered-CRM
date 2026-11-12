import { DetailField } from "@/components/shared/detail-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TagList } from "@/modules/customization/components/tag-chip";
import {
  formatCustomValue,
  visibleFields,
  type CustomValues,
  type FieldDef,
} from "@/modules/customization/custom-fields";
import type { TagDto } from "@/modules/customization/server/queries";

/** Kartu detail: tag + custom field yang tampil (mengikuti conditional logic). Tidak dirender bila kosong. */
export function CustomizationCard({
  defs,
  values,
  tags,
}: {
  defs: FieldDef[];
  values: CustomValues;
  tags: TagDto[];
}) {
  const shown = visibleFields(defs, values);
  if (!shown.length && !tags.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tag & data tambahan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Tag">{tags.length ? <TagList tags={tags} /> : null}</DetailField>
          {shown.map((d) => (
            <DetailField key={d.key} label={d.label}>
              {d.type === "url" && values[d.key] ? (
                <a
                  className="text-primary hover:underline"
                  href={String(values[d.key])}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  {String(values[d.key])}
                </a>
              ) : (
                formatCustomValue(d, values[d.key])
              )}
            </DetailField>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
