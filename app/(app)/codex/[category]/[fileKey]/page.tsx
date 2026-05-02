import { auth } from "@/lib/auth/auth";
import { notFound } from "next/navigation";
import { findEntry } from "@/lib/codex/manifest";
import { resolveFile } from "@/lib/codex/resolver";
import { fileExists } from "@/lib/codex/fileLoader";
import CodexFileView from "@/components/codex/CodexFileView";

interface Props {
  params: Promise<{ category: string; fileKey: string }>;
}

export default async function CodexFilePage({ params }: Props) {
  const { category, fileKey } = await params;

  const entry = findEntry(category, fileKey);
  if (!entry || !fileExists(category, fileKey)) notFound();

  const session = await auth();
  const isEditor =
    session?.user?.isEditor ||
    session?.user?.isAdmin ||
    session?.user?.isSuperuser;

  const resolved = await resolveFile(category, fileKey);

  return (
    <CodexFileView
      category={category}
      fileKey={fileKey}
      label={entry.label}
      resolved={resolved}
      isEditor={!!isEditor}
      sourceId={resolved.sourceId}
    />
  );
}

export async function generateStaticParams() {
  const manifest = (await import("@/data/manifest.json")).default;
  return manifest.map((m: { category: string; fileKey: string }) => ({
    category: m.category,
    fileKey: m.fileKey,
  }));
}
