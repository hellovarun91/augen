import { redirect } from "next/navigation";

// The Brand Board now lives at "/". Keep this path working for old links.
export default function BrandsIndex() {
  redirect("/");
}
