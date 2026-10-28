import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SharedSessionHub from '@/app/portal/instructor/groups/[id]/SharedSessionHub'
import SessionParticipation from '@/components/portal/instructor/SessionParticipation'
import type { SharedSessionItem } from '@/modules/instructor-portal/shared-queries'
const mocks = vi.hoisted(() => ({ open:vi.fn(), participation:vi.fn(),push:vi.fn(),refresh:vi.fn() }))
vi.mock('@/modules/instructor-portal/shared-actions',()=>({openSharedSession:mocks.open,changeParticipation:mocks.participation}))
vi.mock('next/navigation',()=>({useRouter:()=>({push:mocks.push,refresh:mocks.refresh})}))
afterEach(cleanup)
beforeEach(()=>{vi.clearAllMocks();mocks.participation.mockResolvedValue({success:true,data:{sessionId:'s4',groupId:'group',state:'requested'}});mocks.open.mockResolvedValue({success:true,data:{sessionId:'s4',groupId:'group'}})})
const item=(overrides:Partial<SharedSessionItem>={}):SharedSessionItem=>({id:'s4',group_course_id:'course',session_number:4,scheduled_at:'2026-10-21T18:00:00Z',ended_at:null,status:'scheduled',topic:'Loops',attendance_revision:0,participants:[],myState:null,joined:false,isLead:false,...overrides})
describe('role-based shared classes',()=>{
  it('explicitly resumes a legacy ongoing class instead of creating a duplicate',async()=>{
    const user=userEvent.setup();render(<SharedSessionHub groupId="group" courseId="course" sessions={[item({status:'ongoing',leadInstructorId:null})]} />)
    expect(screen.queryByRole('button',{name:'Request assistant participation'})).not.toBeInTheDocument()
    await user.click(screen.getByRole('button',{name:'Resume this class as lead'}))
    expect(mocks.open).toHaveBeenCalledExactlyOnceWith('course','s4',null,'Loops','lead')
  })
  it('preserves class details while blocking role-based writes when the database is not upgraded',()=>{
    render(<SharedSessionHub groupId="group" courseId="course" sessions={[item({status:'ongoing'}),item({id:'old',status:'completed'})]} workflowReady={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('Session workflow update is pending')
    expect(screen.getByRole('link',{name:'Open shared session'})).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:/Request assistant|Start|Create/})).not.toBeInTheDocument()
    expect(mocks.open).not.toHaveBeenCalled()
    expect(mocks.participation).not.toHaveBeenCalled()
  })
  it('offers assistant participation rather than another start for an ongoing class',async()=>{
    const user=userEvent.setup();render(<SharedSessionHub groupId="group" courseId="course" sessions={[item({status:'ongoing'})]} />)
    expect(screen.queryByRole('button',{name:/start|create/i})).not.toBeInTheDocument()
    await user.click(screen.getByRole('button',{name:'Request assistant participation'}))
    expect(mocks.participation).toHaveBeenCalledExactlyOnceWith('s4','request','')
    expect(screen.getByRole('status')).toHaveTextContent('Awaiting')
    expect(mocks.open).not.toHaveBeenCalled()
  })
  it('opens the exact next scheduled class as lead',async()=>{
    const user=userEvent.setup();render(<SharedSessionHub groupId="group" courseId="course" sessions={[item({id:'s12',session_number:12}),item(),item({id:'s3',status:'completed',ended_at:'2026-10-14T20:00:00Z'})]} />)
    await user.type(screen.getByRole('textbox',{name:'Session topic'}),'Functions')
    await user.click(screen.getByRole('button',{name:'Start next scheduled session'}))
    expect(mocks.open).toHaveBeenCalledExactlyOnceWith('course','s4','s3','Functions','lead')
    expect(mocks.push).toHaveBeenCalledWith('/portal/instructor/groups/group/sessions/s4')
  })
  it('explains that an assistant cannot open first and permits an explicit lead substitution',async()=>{
    const user=userEvent.setup();render(<SharedSessionHub groupId="group" courseId="course" sessions={[item()]} />)
    await user.click(screen.getByRole('radio',{name:'Assistant instructor'}))
    await user.type(screen.getByRole('textbox',{name:'Session topic'}),'Substitute lesson')
    expect(screen.getByRole('alert')).toHaveTextContent('A lead instructor must start')
    expect(screen.getByRole('button',{name:'Start next scheduled session'})).toBeDisabled()
    expect(mocks.open).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button',{name:'Teach this class as lead'}))
    await user.click(screen.getByRole('button',{name:'Start next scheduled session'}))
    expect(mocks.open).toHaveBeenCalledWith('course','s4',null,'Substitute lesson','lead')
  })
  it('never asks the lead to reconfirm their own class',()=>{
    render(<SessionParticipation session={item({status:'ongoing',isLead:true,myState:'confirmed'})} />)
    expect(screen.getByRole('status')).toHaveTextContent('Lead instructor')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(/No extra confirmation needed/)).toBeInTheDocument()
  })
  it('permits participation requests for past classes without creating another class',async()=>{
    const user=userEvent.setup();render(<SessionParticipation session={item({status:'completed'})} />)
    await user.click(screen.getByRole('button',{name:'Request assistant participation'}))
    expect(mocks.participation).toHaveBeenCalledWith('s4','request','')
    expect(await screen.findByRole('status')).toHaveTextContent('Awaiting')
    expect(mocks.open).not.toHaveBeenCalled()
  })
  it('keeps participation pending and disables duplicate requests after submission',()=>{
    render(<SessionParticipation session={item({status:'ongoing',myState:'requested'})} />)
    expect(screen.getByRole('status')).toHaveTextContent('Awaiting')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(/No earnings until administration approval/)).toBeInTheDocument()
  })
  it('allows safe retry after network failure',async()=>{
    mocks.participation.mockRejectedValueOnce(new Error('Network'))
    const user=userEvent.setup();render(<SessionParticipation session={item({status:'completed'})} />)
    await user.click(screen.getByRole('button',{name:'Request assistant participation'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please retry')
    await user.click(screen.getByRole('button',{name:'Request assistant participation'}))
    await waitFor(()=>expect(mocks.participation).toHaveBeenCalledTimes(2))
  })
})
