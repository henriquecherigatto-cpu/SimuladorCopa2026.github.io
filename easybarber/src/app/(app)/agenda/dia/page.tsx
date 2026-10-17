import { redirect } from "next/navigation";

// The day view and the (former) week view have merged into one single
// view at /agenda (items 19-20) — this redirect keeps any bookmarked
// or cached /agenda/dia link working.
export default function AgendaDiaPage() {
  redirect("/agenda");
}
