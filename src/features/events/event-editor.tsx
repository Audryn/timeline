"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { Category, EventInput, LifeEvent, Person, Project } from "@/domain/models";
import { eventSchema } from "@/domain/models";
import { dateLabel } from "@/domain/dates";
import { drafts, removeDraft, saveDraft, type Draft } from "@/lib/drafts";
import { message, request, RequestError } from "@/lib/client";
import { DateFields } from "./date-fields";
import { submission, type EventForm } from "./form";
import styles from "../timeline/workspace.module.css";

export function EventEditor({ initial, project, people, categories, onSaved, onClose, registerFlush }: {
  initial: Draft; project: Project; people: Person[]; categories: Category[];
  onSaved: () => void; onClose: () => void;
  registerFlush: (flush: (() => Promise<void>) | null) => void;
}) {
  const [form, setForm] = useState<EventForm>(initial.form);
  const [pending, setPending] = useState<EventInput | null>(initial.pending);
  const [status, setStatus] = useState("Recovering draft...");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<LifeEvent | null>(null);
  const [leased, setLeased] = useState(false);
  const revision = useRef(initial.revision);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alive = useRef(true);
  const identity = useRef(initial);
  const snapshot = useRef(initial.form);

  const persist = useCallback((snapshot: EventForm, attempt: EventInput | null) => {
    const task = queue.current.then(async () => {
      const next = await saveDraft(drafts(), { ...identity.current, form: snapshot, pending: attempt }, revision.current);
      revision.current = next.revision;
      if (alive.current) setStatus(attempt ? "Save awaiting confirmation. Retry the same request." : "Draft saved on this browser. Not yet saved to your account.");
    });
    // Keep subsequent recovery attempts usable after a visible failed write.
    queue.current = task.catch(() => undefined);
    return task;
  }, []);
  useEffect(() => {
    alive.current = true;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => { alive.current = false; clearTimeout(timer.current); window.removeEventListener("beforeunload", warn); };
  }, []);
  useEffect(() => {
    registerFlush(async () => {
      clearTimeout(timer.current);
      await persist(snapshot.current, identity.current.pending);
    });
    return () => registerFlush(null);
  }, [registerFlush, persist]);
  useEffect(() => {
    const controller = new AbortController();
    let release: (() => void) | undefined;
    let stopped = false;
    if (!navigator.locks) {
      queueMicrotask(() => setError("This browser cannot coordinate safe editing across tabs. Use a current supported browser."));
      return;
    }
    void navigator.locks.request(`timeline-editor:${initial.owner}`, { mode: "shared", signal: controller.signal }, async () => {
      if (stopped) return;
      setLeased(true);
      await new Promise<void>((resolve) => { release = resolve; });
    }).catch((problem) => {
      if (!(problem instanceof Error && problem.name === "AbortError")) setError(`Could not protect this editor: ${message(problem)}`);
    });
    return () => {
      stopped = true; controller.abort();
      void queue.current.then(() => release?.());
    };
  }, [initial.owner]);
  useEffect(() => {
    timer.current = setTimeout(() => {
      void persist(form, identity.current.pending).catch((problem) => {
        setStatus("Local draft storage failed. Download a copy before leaving.");
        setError(message(problem));
      });
    }, 400);
    return () => clearTimeout(timer.current);
  }, [form, persist]);

  function change<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    const next = { ...form, [key]: value };
    snapshot.current = next;
    setForm(next);
    setStatus("Saving draft on this browser...");
  }
  function toggle(key: "personIds" | "categoryIds", id: string) {
    change(key, form[key].includes(id) ? form[key].filter((item) => item !== id) : [...form[key], id]);
  }
  async function save() {
    clearTimeout(timer.current);
    setError(""); setSaving(true); setCurrent(null);
    if (!leased) { setError("Wait for the editor to be ready."); setSaving(false); return; }
    let payload: EventInput;
    let contactedServer = false;
    try {
      payload = pending ?? submission(form, crypto.randomUUID());
    } catch (problem) {
      setError(problem instanceof z.ZodError ? problem.issues.map((item) => item.message).join(" ") : message(problem));
      setSaving(false); return;
    }
    try {
      identity.current.pending = payload;
      setPending(payload);
      await persist(form, payload);
      contactedServer = true;
      await request(`/api/projects/${project.id}/events`, z.object({ id: z.uuid(), version: z.number() }), payload);
      await queue.current;
      await removeDraft(drafts(), initial.key, revision.current);
      onSaved();
    } catch (problem) {
      setError(message(problem));
      if (!contactedServer) {
        identity.current.pending = pending;
        setPending(pending);
      } else if (problem instanceof RequestError && problem.status > 0 && problem.status < 500) {
        identity.current.pending = null; setPending(null);
        try { await persist(form, null); } catch (failure) { setError(`${message(problem)} ${message(failure)}`); }
        if (problem.status === 409) {
          try {
            const latest = await request(`/api/projects/${project.id}/events?event=${form.id}`, z.object({ events: z.array(eventSchema), hasMore: z.boolean() }));
            setCurrent(latest.events[0] ?? null);
          } catch (failure) { setError(`${message(problem)} Current version unavailable: ${message(failure)}`); }
        }
      }
    } finally { setSaving(false); }
  }
  async function close() {
    clearTimeout(timer.current);
    try { await persist(form, pending); onClose(); }
    catch (problem) { setError(message(problem)); }
  }
  async function discard() {
    if (pending) { setError("Resolve the unconfirmed save before discarding. It may already be saved to your account."); return; }
    if (!window.confirm("Discard this browser draft? Published events will not be deleted.")) return;
    clearTimeout(timer.current);
    try { await queue.current; await removeDraft(drafts(), initial.key, revision.current); onClose(); }
    catch (problem) { setError(message(problem)); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ form, pending }, null, 2)], { type: "text/plain" }));
    const link = document.createElement("a"); link.href = url; link.download = "timeline-draft.txt"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className={styles.editor} aria-labelledby="event-editor-title">
    <div className={styles.heading}><div><p className={styles.eyebrow}>{project.name} / {form.version ? "Edit event" : "New memory"}</p><h2 id="event-editor-title">A moment to remember.</h2></div>
      <button className={styles.secondary} onClick={() => void close()} disabled={saving}>Close editor</button></div>
    <p className={styles.hint}>Save a memory with as much, or as little, detail as you know.</p>
    <p role="status" className={styles.notice}>{status}</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {pending && <p className={styles.notice}>An earlier save is unconfirmed. Retry it before editing or leaving; it may already have reached the server.</p>}
    {current && <aside className={styles.conflict}><h3>Current account version</h3><strong>{current.title}</strong><p>{dateLabel(current.date)}</p><p>{current.description || "No notes"}</p><p>Your draft is still in the form below. Compare and merge it, then explicitly save against version {current.version}.</p>
      <button className={styles.secondary} onClick={() => { change("version", current.version); setCurrent(null); }}>Keep my draft and use this base version</button></aside>}
    <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={saving || Boolean(pending) || !leased} className={styles.formFields}>
        <label>What happened? <span className={styles.hint}>(required)</span><input autoFocus maxLength={200} value={form.title} onChange={(event) => change("title", event.target.value)} /></label>
        <fieldset className={styles.choices}><legend>Who was involved? (choose at least one)</legend>{people.map((person) =>
          <label className={styles.check} key={person.id}><input type="checkbox" checked={form.personIds.includes(person.id)} onChange={() => toggle("personIds", person.id)} />{person.name}{person.kind === "fictional" ? " (character)" : ""}</label>)}</fieldset>
        <fieldset className={styles.choices}><legend>Categories (optional)</legend>{categories.map((category) =>
          <label className={styles.check} key={category.id}><input type="checkbox" checked={form.categoryIds.includes(category.id)} onChange={() => toggle("categoryIds", category.id)} />{category.name}</label>)}</fieldset>
        <DateFields value={form.date} onChange={(value) => change("date", value)} hemisphere={project.hemisphere} />
        <label>Location (optional)<input maxLength={300} value={form.location} onChange={(event) => change("location", event.target.value)} /></label>
        <label>Notes (optional)<textarea rows={5} maxLength={20000} value={form.description} onChange={(event) => change("description", event.target.value)} /></label>
      </fieldset>
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={saving || !leased}>{saving ? "Saving..." : pending ? "Retry unconfirmed save" : "Save event to account"}</button>
        <button className={styles.secondary} type="button" onClick={download}>Download draft copy</button>
        <button className={styles.textButton} type="button" disabled={saving || Boolean(pending)} onClick={() => void discard()}>Discard draft</button>
      </div>
      <p className={styles.hint}>Publishing requires a connection. Browser drafts can be lost if site data is cleared; downloads are outside account protection.</p>
    </form>
  </section>;
}
