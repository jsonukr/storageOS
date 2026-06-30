export function PropertiesPanel() {
  return (
    <div className="flex flex-col h-full overflow-y-auto select-none">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border">
        <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">
          Properties
        </h3>
      </div>

      {/* Empty state */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-tertiary mx-auto mb-2">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-text-tertiary">
              <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3" />
              <path d="M9 6v4M9 12.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[12px] text-text-tertiary">No item selected</p>
        </div>
      </div>
    </div>
  );
}
