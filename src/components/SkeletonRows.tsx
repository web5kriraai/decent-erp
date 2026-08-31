type SkeletonRowsProps = {
  rows?: number;
  variant?: "table" | "cards" | "stats";
};

export function SkeletonRows({ rows = 5, variant = "table" }: SkeletonRowsProps) {
  if (variant === "stats") {
    return (
      <div className="stat-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton" style={{ height: 12, width: "60%" }} />
            <div className="skeleton" style={{ height: 28, width: "40%", marginTop: 8 }} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div className="kanban">
        {Array.from({ length: 3 }).map((_, col) => (
          <div key={col} className="kanban-column">
            <div className="skeleton" style={{ height: 20, margin: "0.75rem 1rem" }} />
            <div style={{ padding: "0.75rem" }}>
              {Array.from({ length: 2 }).map((__, row) => (
                <div key={row} className="skeleton skeleton-row" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="data-table-wrap" style={{ padding: "1rem" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  );
}
