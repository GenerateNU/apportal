// Central query key factory. Keep key shapes here so invalidation stays in
// sync across hooks — never hand-write a query key in a component.
import type { ApplicationStage, ReviewerRole, Role } from '@/lib/api/types'

export const queryKeys = {
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (reviewerRole?: ReviewerRole) =>
      [...queryKeys.users.lists(), reviewerRole ?? 'any'] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (nuid: string) => [...queryKeys.users.details(), nuid] as const,
    byEmail: (email: string) =>
      [...queryKeys.users.all, 'byEmail', email] as const,
  },

  applicants: {
    all: ['applicants'] as const,
    details: () => [...queryKeys.applicants.all, 'detail'] as const,
    detail: (nuid: string) =>
      [...queryKeys.applicants.details(), nuid] as const,
  },

  applications: {
    all: ['applications'] as const,
    lists: () => [...queryKeys.applications.all, 'list'] as const,
    list: (params?: {
      cycle_id?: string
      stage?: ApplicationStage
      role?: Role
    }) => [...queryKeys.applications.lists(), params ?? {}] as const,
    details: () => [...queryKeys.applications.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.applications.details(), id] as const,
  },

  cycles: {
    all: ['cycles'] as const,
    lists: () => [...queryKeys.cycles.all, 'list'] as const,
    details: () => [...queryKeys.cycles.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.cycles.details(), id] as const,
  },

  questions: {
    all: ['questions'] as const,
    lists: () => [...queryKeys.questions.all, 'list'] as const,
    list: (cycleId: string, role?: Role) =>
      [...queryKeys.questions.lists(), cycleId, role ?? 'any'] as const,
  },

  challenges: {
    all: ['challenges'] as const,
    lists: () => [...queryKeys.challenges.all, 'list'] as const,
    list: (cycleId: string, role?: Role) =>
      [...queryKeys.challenges.lists(), cycleId, role ?? 'any'] as const,
  },

  answers: {
    all: ['answers'] as const,
    lists: () => [...queryKeys.answers.all, 'list'] as const,
    list: (applicationId: string) =>
      [...queryKeys.answers.lists(), applicationId] as const,
  },

  submissions: {
    all: ['submissions'] as const,
    details: () => [...queryKeys.submissions.all, 'detail'] as const,
    detail: (applicationId: string) =>
      [...queryKeys.submissions.details(), applicationId] as const,
  },
} as const
