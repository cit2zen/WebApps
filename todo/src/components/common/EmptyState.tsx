export function EmptyState({ emoji, message }: { emoji: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="text-4xl">{emoji}</span>
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}
