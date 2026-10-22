'use client'

export function PrintButton() {
  return <button className="btn-secondary print-hide" type="button" onClick={() => window.print()}>Print receipt</button>
}
