import { motion } from "framer-motion"

export function Modal({
  onClose, title, children, wide,
}: {
  onClose: () => void
  title: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <>
      <motion.div
        key="modal-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          key="modal-box"
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={`bg-white rounded-2xl shadow-2xl pointer-events-auto w-full ${wide ? "max-w-lg" : "max-w-sm"} max-h-[90vh] flex flex-col overflow-hidden`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] shrink-0">
            <p className="font-bold text-[#0B1F3A] text-[15px]">{title}</p>
            <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0B1F3A] transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-5 py-4">
            {children}
          </div>
        </motion.div>
      </div>
    </>
  )
}
