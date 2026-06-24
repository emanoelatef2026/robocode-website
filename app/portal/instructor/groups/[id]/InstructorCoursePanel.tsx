'use client'

import { useState } from 'react'
import type { Course } from '@/modules/courses/types'

interface Props {
  course: Course
}

function ResourceLink({ label, url }: { label: string; url: string }) {
  const isYouTube = /youtube\.com|youtu\.be/.test(url)
  const isDrive   = /drive\.google\.com/.test(url)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] transition hover:border-[#FF8A1F] hover:bg-[#FFF7EF]"
    >
      <span className="text-base">
        {isYouTube ? '▶' : isDrive ? '📁' : '🔗'}
      </span>
      <span className="truncate">{label}</span>
      <svg viewBox="0 0 20 20" fill="currentColor" className="ml-auto h-3.5 w-3.5 shrink-0 text-[#94A3B8]">
        <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h4a.75.75 0 010 1.5h-4zM14 4.5a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0v-3z" clipRule="evenodd" />
        <path d="M9.53 5.47a.75.75 0 00-1.06 1.06l6 6a.75.75 0 101.06-1.06l-6-6z" />
      </svg>
    </a>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">{title}</p>
      {children}
    </div>
  )
}

export default function InstructorCoursePanel({ course }: Props) {
  const [open, setOpen] = useState(false)

  const hasResources =
    course.resources_url      ||
    course.drive_url          ||
    course.curriculum_folder  ||
    course.syllabus_url       ||
    course.curriculum_url     ||
    course.homework_drive_url

  const hasContent =
    course.description        ||
    course.instructor_notes   ||
    course.session_plans      ||
    course.teaching_guide     ||
    course.expected_outcomes  ||
    course.skills_covered     ||
    course.course_roadmap     ||
    hasResources

  return (
    <div className="ds-card">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-3.5 md:px-5 md:py-4 text-left gap-3"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0B1F3A]">Course Content</p>
          <p className="mt-0.5 text-xs text-[#64748B] truncate">{course.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {course.resources_url && (
            <a
              href={course.resources_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg border border-[#FF8A1F] px-2.5 py-1 text-xs font-medium text-[#FF8A1F] transition hover:bg-[#FFF7EF]"
            >
              Open
            </a>
          )}
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 text-[#94A3B8] transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {/* Expandable body */}
      {open && (
        <div className="border-t border-[#E2E8F0] px-4 py-4 md:px-5 md:py-5 space-y-4 md:space-y-5">

          {!hasContent && (
            <p className="text-sm text-[#94A3B8] italic">No content added to this course yet.</p>
          )}

          {course.description && (
            <Section title="About">
              <p className="text-sm text-[#374151] whitespace-pre-wrap">{course.description}</p>
            </Section>
          )}

          {/* Resource links */}
          {hasResources && (
            <Section title="Resources">
              <div className="space-y-2">
                {course.resources_url      && <ResourceLink label="Main Content"      url={course.resources_url}      />}
                {course.drive_url          && <ResourceLink label="Google Drive"      url={course.drive_url}          />}
                {course.curriculum_folder  && <ResourceLink label="Curriculum Folder" url={course.curriculum_folder}  />}
                {course.syllabus_url       && <ResourceLink label="Syllabus"          url={course.syllabus_url}       />}
                {course.curriculum_url     && <ResourceLink label="Curriculum"        url={course.curriculum_url}     />}
                {course.homework_drive_url && <ResourceLink label="Homework Drive"    url={course.homework_drive_url} />}
              </div>
            </Section>
          )}

          {/* resource_links JSON array */}
          {Array.isArray(course.resource_links) && course.resource_links.length > 0 && (
            <Section title="Additional Links">
              <div className="space-y-2">
                {course.resource_links.map((r, i) => (
                  <ResourceLink key={i} label={r.label || r.url} url={r.url} />
                ))}
              </div>
            </Section>
          )}

          {course.instructor_notes && (
            <Section title="Instructor Notes">
              <p className="text-sm text-[#374151] whitespace-pre-wrap">{course.instructor_notes}</p>
            </Section>
          )}

          {course.session_plans && (
            <Section title="Session Plans">
              <p className="text-sm text-[#374151] whitespace-pre-wrap">{course.session_plans}</p>
            </Section>
          )}

          {course.teaching_guide && (
            <Section title="Teaching Guide">
              <p className="text-sm text-[#374151] whitespace-pre-wrap">{course.teaching_guide}</p>
            </Section>
          )}

          {course.expected_outcomes && (
            <Section title="Expected Outcomes">
              <p className="text-sm text-[#374151] whitespace-pre-wrap">{course.expected_outcomes}</p>
            </Section>
          )}

          {course.skills_covered && (
            <Section title="Skills Covered">
              <p className="text-sm text-[#374151]">{course.skills_covered}</p>
            </Section>
          )}

          {course.course_roadmap && (
            <Section title="Course Roadmap">
              <p className="text-sm text-[#374151] whitespace-pre-wrap">{course.course_roadmap}</p>
            </Section>
          )}

          {course.recommended_age && (
            <p className="text-xs text-[#94A3B8]">Recommended age: {course.recommended_age}</p>
          )}

        </div>
      )}
    </div>
  )
}
