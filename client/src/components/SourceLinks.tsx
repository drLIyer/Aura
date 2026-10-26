import { guidelineById } from "@shared/engine/domain/guidelines";

/** Links each guideline id to its published source. */
export default function SourceLinks({ ids }: { ids: string[] }) {
  const sources = ids.map(guidelineById).filter((g): g is NonNullable<typeof g> => Boolean(g));
  if (!sources.length) return null;
  return (
    <p className="text-xs text-muted-foreground mt-2">
      Based on:{" "}
      {sources.map((g, i) => (
        <span key={g.id}>
          {i > 0 && " · "}
          <a href={g.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
            {g.organization.split(" (")[0]} {g.year}
          </a>
        </span>
      ))}
    </p>
  );
}
