export function EmptyState({ emoji, message }: { emoji: string; message: string }) {
  return (
    <div className="td-empty">
      <div className="pol-card td-empty-card" aria-hidden="true">
        <div className="pol-photo td-empty-photo">{emoji}</div>
        <span className="pol-caption">nothing yet</span>
      </div>
      <p className="td-empty-msg">{message}</p>
    </div>
  );
}
