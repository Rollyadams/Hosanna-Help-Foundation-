import AppShell from '../../components/layout/AppShell'

export default function ComingSoon({ title = 'Coming Soon' }) {
  return (
    <AppShell>
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 bg-hhf-blue-pale rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-hhf-blue" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>
          <h2 className="font-serif text-xl font-semibold text-gray-900 mb-1">{title}</h2>
          <p className="text-gray-400 text-sm">This section is being built. Check back soon.</p>
        </div>
      </div>
    </AppShell>
  )
}