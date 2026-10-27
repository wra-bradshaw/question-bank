import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server'
import { v } from 'convex/values'

export const create = mutation({
  args: {
    title: v.string(),
    questionIds: v.array(v.string()),
  },
  handler: async (ctx, { title, questionIds }) => {
    const createdAt = Date.now()
    return await ctx.db.insert('quizzes', {
      title,
      questionIds,
      answers: {},
      currentQuestion: 0,
      completed: false,
      createdAt,
    })
  },
})

export const get = query({
  args: { quizId: v.id('quizzes') },
  handler: async (ctx, { quizId }) => await ctx.db.get(quizId),
})

export const list = query({
  args: {},
  handler: async (ctx) => await ctx.db.query('quizzes').withIndex('by_created_at').order('desc').collect(),
})

export const remove = mutation({
  args: { quizId: v.id('quizzes') },
  handler: async (ctx, { quizId }) => {
    await ctx.db.delete(quizId)
  },
})

export const saveProgress = mutation({
  args: {
    quizId: v.id('quizzes'),
    title: v.string(),
    answers: v.record(v.string(), v.union(v.string(), v.array(v.string()))),
    currentQuestion: v.number(),
    completed: v.boolean(),
  },
  handler: async (ctx, { quizId, title, answers, currentQuestion, completed }) => {
    await ctx.db.patch(quizId, { title, answers, currentQuestion, completed })
  },
})

export const setQuestions = mutation({
  args: {
    quizId: v.id('quizzes'),
    questionIds: v.array(v.string()),
    answers: v.record(v.string(), v.union(v.string(), v.array(v.string()))),
    currentQuestion: v.number(),
  },
  handler: async (ctx, { quizId, questionIds, answers, currentQuestion }) => {
    await ctx.db.patch(quizId, { questionIds, answers, currentQuestion })
  },
})
