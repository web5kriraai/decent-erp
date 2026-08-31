import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { APP_NAME, APP_DEFAULT_DESCRIPTION } from "@/config/page-metadata";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DEFAULT_DESCRIPTION,
};

export default function HomePage() {
  redirect("/dashboard");
}
