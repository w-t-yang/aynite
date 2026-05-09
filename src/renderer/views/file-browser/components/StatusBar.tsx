export function StatusBar() {
  return (
    <div className="h-7 shrink-0 bg-muted/50 border-t border-border flex items-center px-4 justify-between text-[10px] text-muted-foreground font-sans tracking-wide uppercase">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          VIEW
        </div>
      </div>
      <div className="flex items-center gap-4 opacity-70">
        <div className="flex items-center gap-2">
          <span>UTF-8</span>
          <div className="w-px h-3 bg-border" />
          <span>LF</span>
        </div>
      </div>
    </div>
  )
}
