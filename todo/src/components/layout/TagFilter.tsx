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
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => toggleTag(tag)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            selectedTag === tag
              ? 'bg-lavender-400 text-white'
              : 'bg-white text-muted shadow-sm hover:bg-lavender-50'
          }`}
        >
          #{tag}
        </button>
      ))}
    </div>
  );
}
