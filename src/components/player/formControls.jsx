export function NumInput({ value, onChange, step, placeholder, ariaLabel }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step ?? 1}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

export function TextInput({ value, onChange, placeholder, ariaLabel }) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

export function SelectInput({ value, onChange, options, ariaLabel }) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {options.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
    </select>
  );
}

export function Section({ title, subtitle, children }) {
  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
