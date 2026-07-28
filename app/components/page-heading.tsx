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
      <span className="scrap-label">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{lead}</p>
      {typeof count === "number" ? (
        <span className="page-heading__count" aria-label={`${count} 条内容`}>
          共 {String(count).padStart(2, "0")} 张
        </span>
      ) : null}
    </header>
  );
}
