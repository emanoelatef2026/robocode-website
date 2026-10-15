import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExistingGuardianPicker } from '@/components/portal/shared/ExistingGuardianPicker'
import StudentFormModal from '@/app/portal/team-leader/students/StudentFormModal'
import NewStudentForm from '@/app/admin/students/new/NewStudentForm'

const mocks = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('@/modules/parents/search-actions', () => ({ searchExistingGuardians: mocks.search }))
vi.mock('@/modules/students/modal-actions', () => ({ createStudentModal: vi.fn(), updateStudentModal: vi.fn(), deleteStudentAction: vi.fn() }))
vi.mock('@/modules/students/actions', () => ({ createStudent: vi.fn() }))
vi.mock('@/components/portal/shared/HistoricalReconciliationDialog', () => ({ HistoricalReconciliationDialog: () => null }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
const parent = { contactId: '00000000-0000-4000-8000-000000000011', groupId: 'family-test', name: 'Test Guardian', phone1: '01000000001', phone2: '', relation: 'father' as const, whatsappPreferred: true, children: ['Older Child'] }
describe('existing guardian picker', () => {
  it('finds a guardian, shows sibling context and requires an explicit selection', async () => {
    mocks.search.mockResolvedValue({ success: true, data: [parent] })
    const select = vi.fn(), user = userEvent.setup()
    render(<ExistingGuardianPicker onSelect={select} />)
    await user.type(screen.getByRole('searchbox'), '01000000001')
    expect(await screen.findByText('Children: Older Child')).toBeInTheDocument()
    expect(select).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Test Guardian/ }))
    expect(select).toHaveBeenCalledWith(parent)
  })
  it('shows a recoverable lookup error', async () => {
    mocks.search.mockResolvedValue({ success: false, error: { message: 'Lookup unavailable' } })
    const user = userEvent.setup()
    render(<ExistingGuardianPicker onSelect={vi.fn()} />)
    await user.type(screen.getByRole('searchbox'), 'Test')
    expect(await screen.findByRole('alert')).toHaveTextContent('Lookup unavailable')
  })
  it('does not show password inputs during modal creation and serializes the selected contact reference', async () => {
    mocks.search.mockResolvedValue({ success: true, data: [parent] })
    const user = userEvent.setup()
    const { container } = render(<StudentFormModal mode="create" branchId="branch-test" branchIds={['branch-test']} branches={[{ id: 'branch-test', name: 'Test Branch' }]} isTL onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(container.querySelector('input[type="password"]')).toBeNull()
    await user.type(screen.getByRole('searchbox'), '01000000001')
    await user.click(await screen.findByRole('button', { name: /Test Guardian/ }))
    await waitFor(() => expect(screen.getByDisplayValue('Test Guardian')).toHaveAttribute('readonly'))
    const field = container.querySelector('input[name="parent_contacts_json"]') as HTMLInputElement
    expect(JSON.parse(field.value)[0]).toMatchObject({ source_contact_id: parent.contactId, name: parent.name, phone1: parent.phone1 })
    await user.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(JSON.parse(field.value)[0].source_contact_id).toBe('')
  })
  it('also removes the password requirement from the standalone admin form', () => {
    const { container } = render(<NewStudentForm branches={[]} groups={[]} />)
    expect(container.querySelector('input[type="password"]')).toBeNull()
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })
})
