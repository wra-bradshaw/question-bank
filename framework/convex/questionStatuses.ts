import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server'
import { v } from 'convex/values'

const statusValidator = v.union(v.literal('unanswered'), v.literal('revisit'), v.literal('complete'))

export const list = query({
  args: {},
  handler: async (ctx) => await ctx.db.query('questionStatuses').collect(),
})

export const set = mutation({
  args: {
    questionId: v.string(),
    status: statusValidator,
  },
  handler: async (ctx, { questionId, status }) => {
    const existing = await ctx.db.query('questionStatuses')
      .withIndex('by_question_id', (q) => q.eq('questionId', questionId))
      .first()
    const updatedAt = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, { status, updatedAt })
    } else {
      await ctx.db.insert('questionStatuses', { questionId, status, updatedAt })
    }

    return updatedAt
  },
})
