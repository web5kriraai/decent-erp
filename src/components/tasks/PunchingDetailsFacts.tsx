import type { PriorPunchingDetails } from "@/lib/types/api";

export function hasPriorPunchingDetails(details?: PriorPunchingDetails | null): boolean {
  if (!details) return false;
  return (
    details.stitchCount != null ||
    details.needleCount != null ||
    details.colorCount != null ||
    !!details.machineFormat?.trim() ||
    !!details.hoopSize?.trim() ||
    !!details.softwareName?.trim() ||
    !!details.stitchDensity?.trim()
  );
}

export function PunchingDetailsFacts({
  details,
  framed = false,
}: {
  details: PriorPunchingDetails;
  framed?: boolean;
}) {
  return (
    <dl className={framed ? "punching-facts punching-facts--framed" : "punching-facts"}>
      <div>
        <dt>Stitch count</dt>
        <dd>{details.stitchCount != null ? details.stitchCount.toLocaleString() : "-"}</dd>
      </div>
      <div>
        <dt>Machine format</dt>
        <dd>{details.machineFormat?.trim() || "-"}</dd>
      </div>
      <div>
        <dt>Needle count</dt>
        <dd>{details.needleCount != null ? details.needleCount.toLocaleString() : "-"}</dd>
      </div>
      <div>
        <dt>Color count</dt>
        <dd>{details.colorCount != null ? details.colorCount.toLocaleString() : "-"}</dd>
      </div>
      <div>
        <dt>Hoop size</dt>
        <dd>{details.hoopSize?.trim() || "-"}</dd>
      </div>
      <div>
        <dt>Stitch density</dt>
        <dd>{details.stitchDensity?.trim() ? `${details.stitchDensity.trim()} stitches/mm` : "-"}</dd>
      </div>
      <div>
        <dt>Software</dt>
        <dd>{details.softwareName?.trim() || "-"}</dd>
      </div>
    </dl>
  );
}
