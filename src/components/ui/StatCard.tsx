type StatCardProps = {
  label: string;
  value: string | number;
  trend?: string;
  accent?: boolean;
};

export function StatCard({ label, value, trend, accent }: StatCardProps) {
  return (
    <div className={`stat-card ${accent ? "stat-card--accent" : ""}`}>
      <span className="stat-card-label">{label}</span>
      <span className="stat-card-value">{value}</span>
      {trend && <span className="stat-card-trend">{trend}</span>}
    </div>
  );
}
