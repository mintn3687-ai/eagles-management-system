import { logoutAction } from '@/app/logout/actions'
export function SignOut() {
  return <form action={logoutAction}><button type="submit" className="btn-secondary">Sign out</button></form>
}
