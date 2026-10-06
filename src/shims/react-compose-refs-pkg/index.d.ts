import * as React from 'react'

export type PossibleRef<T> = React.Ref<T> | undefined

export function composeRefs<T>(...refs: PossibleRef<T>[]): React.RefCallback<T>

export function useComposedRefs<T>(...refs: PossibleRef<T>[]): React.RefCallback<T>

export default composeRefs
