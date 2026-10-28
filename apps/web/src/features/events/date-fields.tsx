"use client";

import type { DateDraft } from "./form";
import styles from "../timeline/workspace.module.css";

export function DateFields({ value, onChange, hemisphere }: {
  value: DateDraft; onChange: (value: DateDraft) => void; hemisphere: string;
}) {
  function set<K extends keyof DateDraft>(key: K, next: DateDraft[K]) { onChange({ ...value, [key]: next }); }
  function civil(end = false) {
    const precisionKey = end ? "endPrecision" : "precision";
    const yearKey = end ? "endYear" : "year";
    const monthKey = end ? "endMonth" : "month";
    const dayKey = end ? "endDay" : "day";
    const prefix = end ? "End" : value.kind === "point" ? "Event" : "Start";
    return <div className={styles.civil}>
      <label>{prefix} precision<select value={value[precisionKey]} onChange={(event) => set(precisionKey, event.target.value as DateDraft["precision"])}>
        <option value="year">Year</option><option value="month">Month and year</option><option value="day">Exact day</option>
      </select></label>
      <label>{prefix} year<input type="number" min="1" max="9999" value={value[yearKey]} onChange={(event) => set(yearKey, event.target.value)} /></label>
      {value[precisionKey] !== "year" && <label>{prefix} month<input type="number" min="1" max="12" value={value[monthKey]} onChange={(event) => set(monthKey, event.target.value)} /></label>}
      {value[precisionKey] === "day" && <label>{prefix} day<input type="number" min="1" max="31" value={value[dayKey]} onChange={(event) => set(dayKey, event.target.value)} /></label>}
    </div>;
  }
  return <fieldset className={styles.dateFields}>
    <legend>When did it happen?</legend>
    <label>Date type<select value={value.kind} onChange={(event) => set("kind", event.target.value as DateDraft["kind"])}>
      <option value="unknown">I don&apos;t know yet</option><option value="point">Single date</option>
      <option value="range">Date range / ongoing</option><option value="season">Season</option><option value="custom">In my own words</option>
    </select></label>
    {value.kind === "point" && civil()}
    {value.kind === "range" && <>{civil()}<label className={styles.check}><input type="checkbox" checked={value.ongoing} onChange={(event) => set("ongoing", event.target.checked)} />Still ongoing</label>{!value.ongoing && civil(true)}</>}
    {value.kind === "season" && <>
      <div className={styles.civil}><label>Season<select value={value.season} onChange={(event) => set("season", event.target.value as DateDraft["season"])}>
        <option value="spring">Spring</option><option value="summer">Summer</option><option value="autumn">Autumn</option><option value="winter">Winter</option>
      </select></label><label>Season starting year<input type="number" min="1" max="9998" value={value.year} onChange={(event) => set("year", event.target.value)} /></label></div>
      <p className={styles.hint}>{hemisphere === "northern" ? "Northern" : "Southern"} hemisphere. Cross-year seasons use the year they start.</p>
    </>}
    {value.kind === "custom" && <>
      <label>Date wording<input maxLength={200} placeholder="The summer before we moved" value={value.text} onChange={(event) => set("text", event.target.value)} /></label>
      <label className={styles.check}><input type="checkbox" checked={value.placed} onChange={(event) => set("placed", event.target.checked)} />Add approximate timeline placement</label>
      {value.placed && <>{civil()}<p className={styles.hint}>End is optional. Without an end, placement uses the start&apos;s precision.</p>{civil(true)}</>}
    </>}
    {value.kind !== "custom" && value.kind !== "unknown" && <label className={styles.check}><input type="checkbox" checked={value.approximate} onChange={(event) => set("approximate", event.target.checked)} />This is approximate</label>}
    {value.kind === "unknown" && <p className={styles.hint}>This memory will appear in Undated. You can add a date later.</p>}
  </fieldset>;
}
