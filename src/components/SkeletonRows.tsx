type SkeletonRowsProps = {
  rows?: number;
  variant?: "table" | "cards" | "stats" | "pipeline-accordion" | "workflow-dashboard";
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

  if (variant === "workflow-dashboard") {
    return (
      <div className="workflow-dash-body" aria-busy="true" aria-label="Loading workflow dashboard">
        <div className="stat-grid workflow-dash-stats">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="stat-card">
              <div className="skeleton h-3 w-3/5" />
              <div className="skeleton mt-2 h-7 w-1/3" />
              <div className="skeleton mt-2 h-3 w-4/5" />
            </div>
          ))}
        </div>
        <div className="workflow-dash-filters workflow-dash-skeleton-filters">
          <div className="skeleton h-9 min-w-[12rem] flex-1" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-9 w-36" />
          ))}
        </div>
        <div className="workflow-dash-board-shell">
          <div className="workflow-dash-board-scroll">
            <div className="kanban kanban--workflow-dash">
              {Array.from({ length: 5 }).map((_, col) => (
                <div key={col} className="kanban-column">
                  <div className="kanban-column-header">
                    <div className="skeleton h-4 w-24" />
                    <div className="skeleton h-5 w-8 rounded-full" />
                  </div>
                  <div className="kanban-cards">
                    <article className="workflow-dash-card">
                      <div className="workflow-dash-card__visual">
                        <div className="skeleton workflow-dash-skeleton-photo" />
                      </div>
                      <div className="workflow-dash-skeleton-body">
                        <div className="skeleton h-4 w-3/5" />
                        <div className="skeleton h-3 w-full" />
                        <div className="skeleton h-3 w-4/5" />
                        <div className="skeleton h-3 w-2/3" />
                      </div>
                    </article>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
