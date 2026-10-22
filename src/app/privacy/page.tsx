export const metadata = { title: 'Privacy' }

export default function PrivacyPage() {
  return <article className="space-y-6">
    <h1 className="text-3xl font-bold text-slate-950">Privacy</h1>
    <p className="text-slate-700">Eagles Drama Club keeps a members-only register to run club activities and manage attendance and fees.</p>
    <section className="space-y-2"><h2 className="text-xl font-semibold">What we collect and why</h2><p className="text-slate-700">We keep your name, phone number, email and student registration number, plus any emergency contact details or notes you give us. We use these to maintain the membership register and contact members about club activities.</p><p className="text-slate-700">We also keep login and access records, rehearsal attendance and absence reasons, and fee records such as amount, payment type, date, status and receipt reference. These records help us secure accounts, review attendance and manage club finances.</p></section>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Who can see it</h2><p className="text-slate-700">Committee members can see the records needed to run the club. Super Admins can manage accounts and settings. Members can see their own account and attendance information. The app does not currently send payments to M-Pesa; no payment details are sent to a payment provider by this app.</p></section>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Corrections or deletion</h2><p className="text-slate-700">Ask a club committee member to correct your details or discuss deleting your account. Some payment and audit records may need to remain in the club register for accurate financial and security records.</p></section>
  </article>
}
