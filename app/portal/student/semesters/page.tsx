import { redirect } from 'next/navigation'

// "Semesters" was this page's route name before it was renamed to "history".
// No in-app nav links here anymore — kept only so old bookmarks/shared links
// (e.g. messages sent to students before the rename) don't 404.
export default function StudentSemestersRedirect() {
  redirect('/portal/student/history')
}
