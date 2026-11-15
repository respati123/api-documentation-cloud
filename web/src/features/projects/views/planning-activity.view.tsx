import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { usePlanningViewModel } from '@/features/projects/viewmodels/use-planning.viewmodel'
import { AgentAvatar, Avatar, Panel } from '@/features/projects/views/planning-marks.view'

type Activity = ReturnType<typeof usePlanningViewModel>['activity']

const ACTIONS = Object.keys(PLANNING_TEXT.activity.action) as Array<keyof typeof PLANNING_TEXT.activity.action>

// Only a PM can read the planning log, so the panel stays hidden for everyone else rather than showing an empty list.
export function PlanningActivityView({ activity }: { activity: Activity }) {
  const { t } = useTranslation('planning')
  if (activity.length === 0) return null
  return (
    <Panel title={t(PLANNING_TEXT.activity.title)} testId="planning-activity">
      <ul className="grid gap-3 px-[18px] py-4">
        {activity.map((entry) => {
          const action = ACTIONS.find((key) => key === entry.action)
          return (
            <li key={entry.id} className="grid grid-cols-[26px_minmax(0,1fr)] gap-2.5 text-[13px]">
              {entry.viaAgent ? <AgentAvatar /> : <Avatar name={entry.actor} />}
              <div>
                <span className="font-medium">{entry.actor.split('@')[0]}</span>{' '}
                {action ? t(PLANNING_TEXT.activity.action[action]) : entry.action}
                <div className="text-xs text-muted-foreground">
                  {entry.viaAgent &&
                    `${entry.keyName ? t(PLANNING_TEXT.activity.viaKey, { name: entry.keyName }) : t(PLANNING_TEXT.activity.viaAgent)} · `}
                  {entry.when}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
