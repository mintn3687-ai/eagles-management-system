import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: [
    'tests/phase9.test.ts',
    'tests/consent-repository.test.ts',
    'tests/absences-service.test.ts',
    'tests/admin-repository.test.ts',
    'tests/phase1.test.ts',
    'tests/phase2.test.ts',
    'tests/phase2-service.test.ts',
    'tests/phase3.test.ts',
    'tests/phase3-service.test.ts',
    'tests/phase4.test.ts',
    'tests/phase4-service.test.ts',
    'tests/phase5.test.ts',
    'tests/phase5-service.test.ts',
    'tests/push-reminder-window.test.ts',
    'tests/push-service.test.ts',
    'tests/check-in-qr.test.ts',
    'tests/festivals.test.ts',
    'tests/festivals-service.test.ts',
    'tests/festivals-actions.test.ts',
    'tests/festivals-documents.test.ts',
    'tests/festivals-document-routes.test.ts',
    'tests/festival-document-storage.test.ts',
    'tests/festival-proposal-pdf.test.ts',
    'tests/festival-proposal-route.test.ts',
  ] },
})
