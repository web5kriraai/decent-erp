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
            <div className="skeleton h-3 w-3/5" />
            <div className="skeleton mt-2 h-7 w-2/5" />
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
            <div className="skeleton mx-4 my-3 h-5" />
            <div className="p-3">
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
    <div className="data-table-wrap p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  );
}
