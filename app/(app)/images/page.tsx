import MyImagesList from "@/components/images/MyImagesList";

export default function ImagesPage() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-2">My Images</h1>
      <p className="text-sm text-ink-muted mb-6">
        Upload images to Cloudinary and reference them in notes. Type{" "}
        <kbd className="rounded border border-surface-border px-1">^</kbd> while editing
        a note to insert an image link; click the link in view mode to open the image.
      </p>
      <MyImagesList />
    </div>
  );
}
