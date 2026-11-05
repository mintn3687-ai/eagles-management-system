'use client'

import { useState, type InputHTMLAttributes } from 'react'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  id: string
}

export function PasswordInput({ id, className = 'input', ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return <div className="relative">
    <input {...props} className={`${className} pr-16`} id={id} type={visible ? 'text' : 'password'} />
    <button
      type="button"
      className="absolute inset-y-0 right-2 my-auto min-h-10 rounded-md px-2 text-sm font-medium text-emerald-900 hover:bg-emerald-50"
      aria-controls={id}
      aria-label={visible ? 'Hide password' : 'Show password'}
      aria-pressed={visible}
      onClick={() => setVisible((current) => !current)}
    >
      {visible ? 'Hide' : 'Show'}
    </button>
  </div>
}
