export function SlideShell({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="flex h-full w-full flex-col justify-center px-8 md:px-20 lg:px-28">
      {eyebrow && (
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-primary">
          {eyebrow}
        </p>
      )}
      {children}
    </div>
  )
}
