export function PageHeading({
  eyebrow,
  title,
  lead,
  count,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  count?: number;
}) {
  return (
    <header className="page-heading">
      <span className="security-pill">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{lead}</p>
      {typeof count === "number" ? (
        <span className="page-heading__count" aria-label={`${count} 条内容`}>
          FILES / {String(count).padStart(2, "0")}
        </span>
      ) : null}
    </header>
  );
}
