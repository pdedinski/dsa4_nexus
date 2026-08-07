import { redirect } from "next/navigation";

/** Old Manage URL — keep bookmarks working. */
export default function ManageChargenDataRedirect() {
  redirect("/tools/chargen-data");
}
