import { useInfiniteGoals } from '../hooks/useGoals'
import GoalCard from './GoalCard'

interface GoalListProps {
  userId: string | undefined
}

export default function GoalList({ userId }: GoalListProps) {
  const { goals, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteGoals(userId)

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-8">Loading goals…</p>
  }

  if (isError) {
    return <p className="text-center text-destructive py-8">Failed to load goals.</p>
  }

  if (goals.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No goals yet. Create your first one!</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {goals.map(goal => (
        <GoalCard key={goal.id} goal={goal} />
      ))}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mx-auto px-6 py-2 rounded-lg border border-border bg-background hover:bg-accent transition-colors disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
