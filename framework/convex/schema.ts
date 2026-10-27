import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  quizzes: defineTable({
    title: v.string(),
    questionIds: v.array(v.string()),
    answers: v.record(v.string(), v.union(v.string(), v.array(v.string()))),
    currentQuestion: v.number(),
    completed: v.boolean(),
    createdAt: v.number(),
  }).index('by_created_at', ['createdAt']),
  questionStatuses: defineTable({
    questionId: v.string(),
    status: v.union(v.literal('unanswered'), v.literal('revisit'), v.literal('complete')),
    updatedAt: v.number(),
  }).index('by_question_id', ['questionId']),
})
