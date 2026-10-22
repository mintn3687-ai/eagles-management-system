import { LoginForm } from '@/components/login-form'
export default function LoginPage() {
  return <section className="card mx-auto max-w-lg"><h1>Welcome back</h1><p className="mb-7 text-slate-600">Sign in with the email address registered with the club.</p><LoginForm /><p className="mt-6 text-sm text-slate-500">Need an invitation or help with your password? Contact the committee.</p></section>
}
