export default function HHFLogo({ className = "h-8 w-auto" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
           style={{background: 'linear-gradient(135deg, #1a5fa8, #2e7d32)'}}>
        HHF
      </div>
      <div>
        <div className="font-serif font-semibold text-hhf-blue text-sm leading-tight">HHF CareConnect</div>
        <div className="text-xs text-gray-400 leading-tight">Hossanah Help Foundation</div>
      </div>
    </div>
  )
}