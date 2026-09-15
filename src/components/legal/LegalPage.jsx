export default function LegalPage({ title, updated, children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 text-white" style={{ background: 'linear-gradient(135deg, #1a5fa8, #2e7d32)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm flex-shrink-0">HHF</div>
            <div className="font-serif font-semibold text-lg">Hossanah Help Foundation</div>
          </div>
          <h1 className="font-serif text-2xl font-semibold mt-3">{title}</h1>
          {updated && <p className="text-white/70 text-xs mt-1">Last updated: {updated}</p>}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 bg-white shadow-sm my-6 rounded-2xl legal-content text-sm leading-relaxed text-gray-700 space-y-4">
        {children}
      </div>

      <div className="text-center text-xs text-gray-400 pb-8">
        &copy; {new Date().getFullYear()} Hossanah Help Foundation. All rights reserved.
      </div>
    </div>
  )
}

export function H2({ children }) {
  return <h2 className="font-serif text-lg font-semibold text-hhf-blue mt-6 mb-2">{children}</h2>
}

export function P({ children }) {
  return <p>{children}</p>
}

export function Ul({ children }) {
  return <ul className="list-disc pl-5 space-y-1">{children}</ul>
}
