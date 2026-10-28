export function timelineLogic({ text, from, to, undated }: {
  text: string; from: string | null; to: string | null; undated: boolean;
}) {
  const groups: string[] = [];
  if (text) {
    const escaped = text.replace(/[\\%_]/g, "\\$&").replace(/"/g, '\\"');
    groups.push(`or(title.ilike."%${escaped}%",description.ilike."%${escaped}%",location.ilike."%${escaped}%")`);
  }
  const dated = ["start_date.not.is.null"];
  if (from) dated.push(`or(end_date.is.null,end_date.gte.${from})`);
  if (to) dated.push(`start_date.lte.${to}`);
  groups.push(undated ? `or(and(${dated.join(",")}),start_date.is.null)` : `and(${dated.join(",")})`);
  // PostgREST expects one logic-tree parameter per scope; repeated or= parameters lose conditions.
  return `and(${groups.join(",")})`;
}
