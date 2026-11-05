"use client";

import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { centsToInput } from "@/lib/money";
import type { WishItem } from "@/lib/wishlist";
import { deleteWish, saveWish } from "./actions";

export function WishForm({ item }: { item?: WishItem }) {
  const p = item ? `wish-${item.id}` : "wish-new";
  return (
    <ActionForm action={saveWish} resetOnSuccess={!item} className="grid grid-cols-2 gap-3">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="col-span-2 space-y-1.5">
        <label htmlFor={`${p}-name`} className="label">What</label>
        <input id={`${p}-name`} name="name" defaultValue={item?.name} maxLength={100} required className="input" placeholder="Wireless headphones" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${p}-price`} className="label">Price (R)</label>
        <input id={`${p}-price`} name="price" inputMode="decimal" defaultValue={item ? centsToInput(item.price_cents) : ""} required className="input money" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${p}-priority`} className="label">How much you want it</label>
        <select id={`${p}-priority`} name="priority" defaultValue={String(item?.priority ?? 2)} className="input select">
          <option value="1">Need soon</option>
          <option value="2">Want</option>
          <option value="3">Someday</option>
        </select>
      </div>
      <div className="col-span-2 space-y-1.5">
        <label htmlFor={`${p}-link`} className="label">Link <span className="font-normal text-muted">(optional)</span></label>
        <input id={`${p}-link`} name="link" type="url" inputMode="url" defaultValue={item?.link ?? ""} maxLength={500} className="input" placeholder="https://" />
      </div>
      <div className="col-span-2 space-y-1.5">
        <label htmlFor={`${p}-notes`} className="label">Notes <span className="font-normal text-muted">(optional)</span></label>
        <input id={`${p}-notes`} name="notes" defaultValue={item?.notes ?? ""} maxLength={500} className="input" />
      </div>
      <SubmitButton className="btn btn-primary col-span-2" pending="Saving…">{item ? "Save" : "Add to wish list"}</SubmitButton>
    </ActionForm>
  );
}

export function DeleteWish({ id, name }: { id: string; name: string }) {
  return (
    <ActionForm action={deleteWish} confirm={`Remove ${name} from your wish list?`}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn btn-danger btn-sm px-0">Remove</SubmitButton>
    </ActionForm>
  );
}
