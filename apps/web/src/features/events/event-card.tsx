"use client";

import type { Category, LifeEvent, Person } from "@timeline/shared";
import { dateLabel } from "@timeline/shared";
import { Button, Card } from "@/components/ui";
import styles from "../timeline/workspace.module.css";

export function EventCard({ event, people, categories, onEdit }: {
  event: LifeEvent; people: Person[]; categories: Category[]; onEdit: (event: LifeEvent) => void;
}) {
  return <Card as="article" className={styles.event}>
    <p className={styles.date}>{dateLabel(event.date)} <span>{event.date.kind === "range" ? " / duration" : event.date.kind === "unknown" ? "" : " / date precision preserved"}</span></p>
    <Button className={styles.eventTitle} onClick={() => onEdit(event)}>{event.title}</Button>
    {event.location && <p className={styles.location}>{event.location}</p>}
    <p className={styles.participants}>{people.filter((person) => event.person_ids.includes(person.id)).map((person) => person.name).join(", ")}</p>
    <div className={styles.actions}>{event.category_ids.length ? categories.filter((category) => event.category_ids.includes(category.id)).map((category) => <span className={styles.pill} key={category.id}>{category.name}</span>) : <span className={styles.pill}>Uncategorized</span>}</div>
    {event.description && <p className={styles.notes}>{event.description}</p>}
    <Button className={styles.textButton} onClick={() => onEdit(event)}>Edit event / recover draft &rarr;</Button>
  </Card>;
}
