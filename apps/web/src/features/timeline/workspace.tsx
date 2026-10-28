"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Category, type LifeEvent, type Person, type Project, type ProjectInput,
  type PersonInput, type ProjectDetail as Detail, type Session,
} from "@timeline/shared";
import { dateLabel } from "@/domain/dates";
import { apiClient, message, RequestError } from "@/lib/client";
import { drafts, draftSchema, type Draft } from "@/lib/drafts";
import { emptyDate, formForEvent } from "../events/form";
import { EventEditor } from "../events/event-editor";
import styles from "./workspace.module.css";

type TimelineFilter = { people: string[]; categories: string[]; text: string; from: string; to: string; undated: boolean };
function emptyFilter(): TimelineFilter { return { people: [], categories: [], text: "", from: "", to: "", undated: true }; }

function ProjectForm({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("My life");
  const [personName, setPersonName] = useState("");
  const [personKind, setPersonKind] = useState<"real" | "fictional">("real");
  const [hemisphere, setHemisphere] = useState<"northern" | "southern">("northern");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState<ProjectInput | null>(null);
  async function save() {
    const payload = attempt ?? { requestId: crypto.randomUUID(), name, personName, personKind, hemisphere };
    setBusy(true); setError(""); setAttempt(payload);
    try {
      const result = await apiClient.createProject(payload);
      onCreated(result.id);
    } catch (problem) {
      setError(message(problem));
      if (problem instanceof RequestError && problem.status > 0 && problem.status < 500) setAttempt(null);
    } finally { setBusy(false); }
  }
  return <section className={styles.editor}>
    <p className={styles.eyebrow}>A home for your stories</p><h2>Whose story is this?</h2>
    <p className={styles.hint}>One project can hold many people or characters. Start with one.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {attempt && !busy && <p className={styles.notice}>The save is unconfirmed. Retry the same request before changing these details.</p>}
    <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy || Boolean(attempt)} className={styles.formFields}>
        <label>Project name<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>First person or character&apos;s name<input required maxLength={100} value={personName} onChange={(event) => setPersonName(event.target.value)} /></label>
        <label>Profile type<select value={personKind} onChange={(event) => setPersonKind(event.target.value as typeof personKind)}><option value="real">Real person</option><option value="fictional">Fictional character</option></select></label>
        <label>Hemisphere for seasonal dates<select value={hemisphere} onChange={(event) => setHemisphere(event.target.value as typeof hemisphere)}><option value="northern">Northern</option><option value="southern">Southern</option></select></label>
      </fieldset>
      <div className={styles.actions}><button className={styles.primary} disabled={busy} type="submit">{busy ? "Creating..." : attempt ? "Retry project creation" : "Create project"}</button>
        <button className={styles.secondary} disabled={busy || Boolean(attempt)} type="button" onClick={onCancel}>Cancel</button></div>
      <p className={styles.hint}>Your timeline and editable category templates are created together. No birth date or photo needed.</p>
    </form>
  </section>;
}

export function Workspace({ projectId }: { projectId?: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editor, setEditor] = useState<Draft | null>(null);
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [changingAccount, setChangingAccount] = useState(false);
  const [privacyIssue, setPrivacyIssue] = useState("");
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>(emptyFilter);
  const [appliedFilter, setAppliedFilter] = useState<TimelineFilter>(emptyFilter);
  const flush = useRef<(() => Promise<void>) | null>(null);
  const currentOwner = useRef<string | null>(null);
  const registerFlush = useCallback((callback: (() => Promise<void>) | null) => { flush.current = callback; }, []);

  const clearPrivate = useCallback(() => {
    currentOwner.current = null; setProjects([]); setDetail(null); setEditor(null); setSession(null); setNotice("");
    setTimelineFilter(emptyFilter()); setAppliedFilter(emptyFilter());
  }, []);
  const accountChanged = useCallback(async () => {
    setChangingAccount(true);
    let failure = "";
    try { await flush.current?.(); }
    catch (problem) { failure = `The account changed, but the previous browser draft could not be saved. ${message(problem)}`; }
    clearPrivate();
    setPrivacyIssue(failure);
    setChangingAccount(false);
    setRefresh((value) => value + 1);
  }, [clearPrivate]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const current = await apiClient.session(controller.signal);
        if (controller.signal.aborted) return;
        if (currentOwner.current && currentOwner.current !== current.user?.id) {
          await accountChanged();
          return;
        }
        currentOwner.current = current.user?.id ?? null;
        setSession(current);
        if (!current.user) { setDetail(null); setProjects([]); setEditor(null); return; }
        if (projectId) {
          const result = await apiClient.project(projectId, controller.signal);
          if (!controller.signal.aborted) setDetail(result);
        } else {
          const result = await apiClient.projects(controller.signal);
          if (!controller.signal.aborted) setProjects(result);
        }
        setError("");
      } catch (problem) {
        if (!controller.signal.aborted) {
          setError(message(problem));
          if (problem instanceof RequestError && problem.status === 401) clearPrivate();
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [projectId, refresh, clearPrivate, accountChanged]);

  useEffect(() => {
    const channel = new BroadcastChannel("timeline-account");
    channel.onmessage = () => { void accountChanged(); };
    const revalidate = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await apiClient.session();
        if ((next.user?.id ?? null) !== currentOwner.current) await accountChanged();
        else if (!flush.current) setRefresh((value) => value + 1);
      } catch (problem) { setError(`Could not check the current session. ${message(problem)}`); }
    };
    document.addEventListener("visibilitychange", revalidate);
    return () => { channel.close(); document.removeEventListener("visibilitychange", revalidate); };
  }, [accountChanged]);

  async function signOut() {
    if (!session?.user || signingOut) return;
    if (editor) { setError("Close the editor to save its draft before signing out."); return; }
    setSigningOut(true); setError("");
    try {
      if (!navigator.locks) throw new Error("Safe sign-out requires a current browser with cross-tab coordination.");
      await navigator.locks.request(`timeline-editor:${session.user.id}`, { mode: "exclusive", ifAvailable: true }, async (lock) => {
        if (!lock) throw new Error("Another tab has an open event editor. Close it to save its draft before signing out.");
        const count = await drafts().drafts.where("owner").equals(session.user!.id).count();
        if (count && !window.confirm(`Discard ${count} browser draft(s) and sign out? Cancel to return and save them first.`)) return;
        await apiClient.signOut();
        let cleanupError = "";
        try { await drafts().drafts.where("owner").equals(session.user!.id).delete(); }
        catch (problem) { cleanupError = `Signed out, but browser draft cleanup failed. Clear this site's data before sharing the device. ${message(problem)}`; }
        clearPrivate();
        const channel = new BroadcastChannel("timeline-account"); channel.postMessage("changed"); channel.close();
        if (cleanupError) { setError(cleanupError); return; }
        window.location.assign("/account?mode=signin");
      });
    } catch (problem) { setError(message(problem)); }
    finally { setSigningOut(false); }
  }
  async function openEditor(event?: LifeEvent) {
    if (!session?.user || !detail) return;
    setError(""); setNotice("");
    const key = `${session.user.id}:${detail.project.id}:${event?.id ?? "new"}`;
    try {
      const stored = await drafts().drafts.get(key);
      const value: Draft = stored ? draftSchema.parse(stored) : {
        key, owner: session.user.id, project: detail.project.id, revision: 0, pending: null,
        form: event ? formForEvent(event) : {
          id: crypto.randomUUID(), version: 0, title: "", description: "", location: "",
          date: { ...emptyDate }, personIds: detail.people[0] ? [detail.people[0].id] : [], categoryIds: [],
        },
      };
      setEditor(value);
    } catch (problem) { setError(`Could not open recoverable draft storage. ${message(problem)}`); }
  }
  return <>{changingAccount && <p role="status" className={styles.notice}>The account changed. Protecting your draft and reopening the workspace...</p>}<section hidden={changingAccount} className={styles.workspace}>
    <div className={styles.heading}>
      <div><p className={styles.eyebrow}>Your life, in context</p><h1>{detail?.project.name ?? "Your projects"}</h1></div>
      {session?.user && <div className={styles.account}><span>{session.user.email}</span><button className={styles.secondary} disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "Signing out..." : "Sign out"}</button></div>}
    </div>
    {error && <div className={styles.error} role="alert">{error} <button className={styles.textButton} onClick={() => setRefresh((value) => value + 1)}>Retry loading</button></div>}
    {privacyIssue && <p className={styles.error} role="alert">{privacyIssue}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {!session && !error && <p role="status">Opening your workspace...</p>}
    {session && !session.configured && <div className={styles.empty}>
      <span className={styles.largeSymbol}>+</span><h2>Your workspace is ready for its connection.</h2>
      <p>Supabase has not been configured yet. Account creation and cloud saves are unavailable until setup is complete.</p>
      <Link className={styles.primary} href="/setup">Open setup instructions</Link>
      <p className={styles.hint}>This is not a demo account. No personal content is being saved.</p>
    </div>}
    {session?.configured && !session.user && <div className={styles.empty}><h2>A private place for your memories.</h2><p>Sign in or create a verified account to start a project.</p><Link className={styles.primary} href="/account?mode=signin">Sign in</Link></div>}
    {session?.user && !projectId && !creating && <>
      <div className={styles.heading}><p className={styles.hint}>Keep your own life, family stories, and fictional worlds in separate projects.</p><button className={styles.primary} onClick={() => setCreating(true)}>+ New project</button></div>
      {!projects.length && !error ? <div className={styles.empty}><h2>Every life has a story.</h2><p>Start with a project and one person. Your timeline will grow one memory at a time.</p><button className={styles.primary} onClick={() => setCreating(true)}>Create your first project</button></div> :
        <div className={styles.projects}>{projects.map((project) => <Link className={styles.projectCard} key={project.id} href={`/projects/${project.id}`}><p className={styles.eyebrow}>Life project</p><h2>{project.name}</h2><p>{project.hemisphere === "northern" ? "Northern" : "Southern"} hemisphere</p><span>Open timeline &rarr;</span></Link>)}</div>}
    </>}
    {session?.user && creating && <ProjectForm onCancel={() => setCreating(false)} onCreated={(id) => window.location.assign(`/projects/${id}`)} />}
    {session?.user && detail && !editor && <>
      <div className={styles.heading}><Link href="/projects" className={styles.back}>&larr; All projects</Link><button className={styles.primary} onClick={() => void openEditor()}>+ Add event / recover new draft</button></div>
      <People project={detail.project} people={detail.people} onAdded={() => setRefresh((value) => value + 1)} />
      <Timeline key={`${detail.project.id}:${refresh}`} project={detail.project} people={detail.people} categories={detail.categories} refresh={refresh}
        filter={timelineFilter} applied={appliedFilter} onFilter={setTimelineFilter} onApplied={setAppliedFilter}
        onEdit={(event) => void openEditor(event)} onAdd={() => void openEditor()} />
      <p className={styles.milestone}>First-use build: event capture and browser draft recovery. Photos, recording, guided stories, category editing, Trash, and PDF export are later milestones.</p>
    </>}
    {session?.user && detail && editor && <EventEditor key={editor.key} initial={editor} project={detail.project} people={detail.people} categories={detail.categories} registerFlush={registerFlush}
      onClose={() => { setEditor(null); setRefresh((value) => value + 1); }}
      onSaved={() => { setEditor(null); setNotice("Your event is saved to your account."); setRefresh((value) => value + 1); }} />}
  </section></>;
}

function People({ project, people, onAdded }: { project: Project; people: Person[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false); const [name, setName] = useState("");
  const [kind, setKind] = useState<"real" | "fictional">("real");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [pending, setPending] = useState<PersonInput | null>(null);
  async function add() {
    setBusy(true); setError("");
    const input = pending ?? { requestId: crypto.randomUUID(), name, kind }; setPending(input);
    try { await apiClient.addPerson(project.id, input); setPending(null); setName(""); setOpen(false); onAdded(); }
    catch (problem) {
      setError(message(problem));
      if (problem instanceof RequestError && problem.status > 0 && problem.status < 500) setPending(null);
    } finally { setBusy(false); }
  }
  return <section className={styles.people}>
    <div className={styles.actions}><strong>People in this project</strong>{people.map((person) => <span className={styles.pill} key={person.id}>{person.name}{person.kind === "fictional" ? " / character" : ""}</span>)}<button className={styles.textButton} onClick={() => setOpen(!open)}>+ Add person or character</button></div>
    {open && <form className={styles.personForm} onSubmit={(event) => { event.preventDefault(); void add(); }}>
      <fieldset className={styles.formFields} disabled={busy || Boolean(pending)}>
        <label>Display name<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Type<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="real">Real person</option><option value="fictional">Fictional character</option></select></label>
      </fieldset><button className={styles.secondary} disabled={busy}>{busy ? "Adding..." : pending ? "Retry adding person" : "Add to project"}</button>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </form>}
  </section>;
}

function Timeline({ project, people, categories, refresh, onEdit, onAdd, filter, applied, onFilter, onApplied }: {
  project: Project; people: Person[]; categories: Category[]; refresh: number;
  onEdit: (event: LifeEvent) => void; onAdd: () => void;
  filter: TimelineFilter; applied: TimelineFilter;
  onFilter: (value: TimelineFilter) => void; onApplied: (value: TimelineFilter) => void;
}) {
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false); const [page, setPage] = useState(0);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    const params = new URLSearchParams({ offset: String(page * 50), q: applied.text, from: applied.from, to: applied.to, undated: String(applied.undated) });
    applied.people.forEach((id) => params.append("person", id));
    applied.categories.forEach((id) => params.append("category", id));
    apiClient.events(project.id, params, abort.signal)
      .then((data) => {
        if (abort.signal.aborted) return;
        setEvents((old) => page ? Array.from(new Map([...old, ...data.events].map((event) => [event.id, event])).values()) : data.events);
        setMore(data.hasMore); setError("");
      })
      .catch((problem) => { if (!abort.signal.aborted) setError(message(problem)); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [project.id, page, applied, refresh, generation]);
  return <section aria-label="Project timeline">
    <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); setLoading(true); setPage(0); onApplied({ ...filter }); }}>
      <label>Search memories<input type="search" maxLength={200} placeholder="A place, a moment, a person..." value={filter.text} onChange={(event) => onFilter({ ...filter, text: event.target.value })} /></label>
      <label>People<select multiple value={filter.people} onChange={(event) => onFilter({ ...filter, people: Array.from(event.target.selectedOptions, (option) => option.value) })}>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <label>Categories<select multiple value={filter.categories} onChange={(event) => onFilter({ ...filter, categories: Array.from(event.target.selectedOptions, (option) => option.value) })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>From<input type="date" value={filter.from} onChange={(event) => onFilter({ ...filter, from: event.target.value })} /></label>
      <label>To<input type="date" value={filter.to} onChange={(event) => onFilter({ ...filter, to: event.target.value })} /></label>
      <label className={styles.check}><input type="checkbox" checked={filter.undated} onChange={(event) => onFilter({ ...filter, undated: event.target.checked })} />Include Undated</label>
      <button className={styles.secondary}>Apply filters</button>
      <button className={styles.textButton} type="button" onClick={() => { const empty = emptyFilter(); onFilter(empty); onApplied(empty); setPage(0); setLoading(true); }}>Clear</button>
      <p className={styles.hint}>No selection includes everyone/all categories. Multiple selections match any item within that filter.</p>
    </form>
    {error && <p role="alert" className={styles.error}>{error} <button className={styles.textButton} onClick={() => { setLoading(true); setGeneration((value) => value + 1); }}>Retry events</button></p>}
    {loading && <p role="status">Loading memories...</p>}
    {!loading && !error && events.length === 0 && <div className={styles.empty}><span className={styles.largeSymbol}>+</span><h2>Your story can start anywhere.</h2><p>Add a first home, a school year, or a friendship. You don&apos;t need an exact date.</p><button className={styles.primary} onClick={onAdd}>Add an event</button><p className={styles.hint}>If you have already added events, try clearing the filters.</p></div>}
    <ol className={styles.timeline}>{events.map((event, index) => {
      const year = event.start_date?.slice(0, 4) ?? "Undated";
      const previousYear = events[index - 1]?.start_date?.slice(0, 4) ?? (index ? "Undated" : null);
      return <li key={event.id}>{year !== previousYear && <h2 className={styles.year}>{year}</h2>}
        <article className={styles.event}>
          <p className={styles.date}>{dateLabel(event.date)} <span>{event.date.kind === "range" ? " / duration" : event.date.kind === "unknown" ? "" : " / date precision preserved"}</span></p>
          <button className={styles.eventTitle} onClick={() => onEdit(event)}>{event.title}</button>
          {event.location && <p className={styles.location}>{event.location}</p>}
          <p className={styles.participants}>{people.filter((person) => event.person_ids.includes(person.id)).map((person) => person.name).join(", ")}</p>
          <div className={styles.actions}>{event.category_ids.length ? categories.filter((category) => event.category_ids.includes(category.id)).map((category) => <span className={styles.pill} key={category.id}>{category.name}</span>) : <span className={styles.pill}>Uncategorized</span>}</div>
          {event.description && <p className={styles.notes}>{event.description}</p>}
          <button className={styles.textButton} onClick={() => onEdit(event)}>Edit event / recover draft &rarr;</button>
        </article>
      </li>;
    })}</ol>
    {more && <button className={styles.secondary} disabled={loading} onClick={() => { setLoading(true); setPage((value) => value + 1); }}>Load more memories</button>}
  </section>;
}
