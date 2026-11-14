import { useForm } from '@tanstack/react-form'
import type { AnswerValue } from '../../components/QuestionField'

export type ApplicationFormValues = {
  answers: Record<string, AnswerValue>
  submissionUrl: string
}

export function useApplicationForm(defaultValues: ApplicationFormValues) {
  return useForm({ defaultValues })
}

export type ApplicationForm = ReturnType<typeof useApplicationForm>
