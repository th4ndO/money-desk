import { PageHeader } from "@/components/PageHeader";
import { TickButton } from "@/components/TickButton";
import { requireUser } from "@/lib/auth";
import { formatShortDate, todayJHB } from "@/lib/dates";
import type { TodoRow } from "@/lib/types";
import { setTodoDone } from "./actions";
import { AddTodoForm, DeleteTodo } from "./forms";

export const metadata = { title: "To do" };

function TodoItem({ todo, today }: { todo: TodoRow; today: string }) {
  const late = !todo.done && todo.due_date !== null && todo.due_date < today;
  return (
    <li className="row">
      <TickButton itemId={todo.id} paid={todo.done} label={todo.text} action={setTodoDone} states={["done", "not done"]} />
      <div className="min-w-0 flex-1">
        <p className={todo.done ? "text-muted line-through decoration-1" : ""}>{todo.text}</p>
        {todo.due_date && <p className={`text-sm ${late ? "text-warn" : "text-muted"}`}>{late ? "Was due" : "Due"} {formatShortDate(todo.due_date)}</p>}
      </div>
      <DeleteTodo id={todo.id} text={todo.text} />
    </li>
  );
}

export default async function TodosPage() {
  const { supabase } = await requireUser();
  const today = todayJHB();
  const { data } = await supabase.from("todos").select("id, text, done, due_date, sort_order").order("sort_order").order("created_at");
  const todos = (data ?? []) as TodoRow[];
  const open = todos
    .filter((t) => !t.done)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.sort_order - b.sort_order);
  const done = todos.filter((t) => t.done);

  return (
    <div className="space-y-8">
      <PageHeader title="To do" />
      <section className="card"><AddTodoForm /></section>
      <section>
        {open.length === 0 ? <p className="text-muted">Nothing to do.</p> : <ul>{open.map((t) => <TodoItem key={t.id} todo={t} today={today} />)}</ul>}
      </section>
      {done.length > 0 && (
        <details>
          <summary className="section-title">Done ({done.length})</summary>
          <ul className="mt-2">{done.map((t) => <TodoItem key={t.id} todo={t} today={today} />)}</ul>
        </details>
      )}
    </div>
  );
}
