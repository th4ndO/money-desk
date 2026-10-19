"use client";

import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { addTodo, deleteTodo } from "./actions";

export function AddTodoForm() {
  return (
    <ActionForm action={addTodo} resetOnSuccess className="grid grid-cols-[1fr_auto] gap-3">
      <div className="col-span-2 space-y-1.5">
        <label htmlFor="todo-text" className="label">To do</label>
        <input id="todo-text" name="text" maxLength={300} required className="input" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="todo-due" className="label">Due <span className="font-normal text-muted">(optional)</span></label>
        <input id="todo-due" name="due_date" type="date" className="input" />
      </div>
      <SubmitButton className="btn btn-primary self-end" pending="Adding…">Add</SubmitButton>
    </ActionForm>
  );
}

export function DeleteTodo({ id, text }: { id: string; text: string }) {
  return (
    <ActionForm action={deleteTodo}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn btn-quiet btn-sm" aria-label={`Delete: ${text}`}>✕</SubmitButton>
    </ActionForm>
  );
}
