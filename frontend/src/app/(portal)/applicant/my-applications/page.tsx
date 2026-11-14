import { redirect } from 'next/navigation'

export default function MyApplicationsPage() {
  redirect('/applicant/applications?tab=mine')
}
