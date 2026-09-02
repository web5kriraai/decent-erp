type SkeletonRowsProps = {
  rows?: number;
  variant?: "table" | "cards" | "stats" | "pipeline-accordion";
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

  if (variant === "pipeline-accordion") {
    return (
      <div className="pipeline-accordion pipeline-accordion-skeleton">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="pipeline-accordion-section">
            <div className="pipeline-accordion-trigger">
              <div className="skeleton h-9 w-9 rounded-md" />
              <div className="skeleton h-5 flex-1 max-w-[10rem]" />
              <div className="skeleton h-6 w-8 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div className="kanban-board scroll-x-region">
        <div className="kanban">
          {Array.from({ length: 4 }).map((_, col) => (
            <div key={col} className="kanban-column">
              <div className="kanban-column-header">
                <div className="skeleton h-5 w-24" />
                <div className="skeleton h-5 w-6 rounded-full" />
              </div>
              <div className="kanban-cards">
                {Array.from({ length: 2 }).map((__, row) => (
                  <div key={row} className="skeleton h-24 rounded-md" />
                ))}
              </div>
            </div>
          ))}
        </div>
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
