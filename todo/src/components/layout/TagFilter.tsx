import { useAppStore } from '../../store/useAppStore';
import { collectTags } from '../../utils/selectors';

export function TagFilter() {
  const projects = useAppStore((s) => s.projects);
  const tasks = useAppStore((s) => s.tasks);
  const selectedTag = useAppStore((s) => s.selectedTag);
  const toggleTag = useAppStore((s) => s.toggleTag);

  const tags = collectTags(projects, tasks);
  if (tags.length === 0) return null;

  return (
    <div className="td-tags-filter" aria-label="태그 필터">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          aria-pressed={selectedTag === tag}
          onClick={() => toggleTag(tag)}
          className="pol-chip td-chip"
        >
          #{tag}
        </button>
      ))}
    </div>
  );
}
