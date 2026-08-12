export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-14 text-center">
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon size={22} />
        </div>
      )}
      <div>
        <p className="font-semibold text-gray-800 dark:text-white">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
