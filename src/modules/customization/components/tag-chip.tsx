import { ToneBadge } from "@/components/shared/tone-badge";
import type { TagDto } from "@/modules/customization/server/queries";

/** Tag sebagai badge berwarna (tone semantik). */
export function TagChip({ tag }: { tag: Pick<TagDto, "name" | "color"> }) {
  return <ToneBadge tone={tag.color}>{tag.name}</ToneBadge>;
}

export function TagList({ tags }: { tags?: Pick<TagDto, "id" | "name" | "color">[] }) {
  if (!tags?.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <TagChip key={t.id} tag={t} />
      ))}
    </span>
  );
}
