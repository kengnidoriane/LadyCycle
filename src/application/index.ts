// application — Use Cases (orchestration entre domain et infrastructure)
export { RecordPeriodUseCase } from './RecordPeriodUseCase'
export type { RecordPeriodError, INotificationManager } from './RecordPeriodUseCase'

export { PredictNextCycleUseCase } from './PredictNextCycleUseCase'
export type { PredictionResult, PredictNextCycleError } from './PredictNextCycleUseCase'

export { MarkCycleExceptionalUseCase } from './MarkCycleExceptionalUseCase'
export type { MarkCycleExceptionalError } from './MarkCycleExceptionalUseCase'

export { GetDailyAdviceUseCase } from './GetDailyAdviceUseCase'
export type { GetDailyAdviceError } from './GetDailyAdviceUseCase'
