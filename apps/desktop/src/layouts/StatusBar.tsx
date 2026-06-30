export function StatusBar() {
  return (
    <footer className="flex h-6 items-center border-t border-border bg-statusbar px-3 text-[11px] text-text-secondary select-none">
      <div className="flex items-center gap-3">
        <StatusItem>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
          Ready
        </StatusItem>
        <StatusDivider />
        <StatusItem>Local Storage</StatusItem>
        <StatusDivider />
        <StatusItem>0 items</StatusItem>
      </div>
      <div className="flex-1" />
      <StatusItem>100%</StatusItem>
    </footer>
  );
}

function StatusItem({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">{children}</span>
  );
}

function StatusDivider() {
  return <span className="w-px h-3 bg-border" />;
}
