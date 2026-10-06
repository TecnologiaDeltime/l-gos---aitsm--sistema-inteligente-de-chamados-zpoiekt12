import * as React from 'react'

/**
 * Set a given ref to a given value
 * This utility takes care of different types of refs: callback refs and RefObject(s)
 */
function setRef(ref, value) {
  if (typeof ref === 'function') {
    return ref(value)
  } else if (ref !== null && ref !== undefined) {
    ref.current = value
  }
}

/**
 * A utility to compose multiple refs together
 * Accepts callback refs and RefObject(s)
 */
export function composeRefs(...refs) {
  return (node) => {
    let hasCleanup = false
    const cleanups = refs.map((ref) => {
      const cleanup = setRef(ref, node)
      if (!hasCleanup && typeof cleanup === 'function') {
        hasCleanup = true
      }
      return cleanup
    })

    if (hasCleanup) {
      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i]
          if (typeof cleanup === 'function') {
            cleanup()
          } else {
            setRef(refs[i], null)
          }
        }
      }
    }
  }
}

/**
 * A custom hook that composes multiple refs.
 *
 * React 19 Fix (issues #3799 and #3963):
 * In React 19, ref callbacks support cleanup returns. When composeRefs / useComposedRefs
 * produces a new ref function identity on each render (e.g. because inline closures or
 * dynamic refs are passed), React 19 invokes the cleanup of the previous ref callback
 * and immediately mounts the new one on commit. If any ref in the chain triggers a state
 * update (e.g. setContent, setNode, setTrigger), this causes a continuous loop:
 * ref mounts -> setState -> re-render -> new ref callback identity -> ref cleanup & remount -> setState...
 * exceeding React's maximum update depth.
 *
 * This shim ensures a stable ref callback reference across renders by keeping the refs in
 * a mutable ref container and only invoking individual ref callbacks when the underlying
 * node actually changes (or when unmounting).
 */
export function useComposedRefs(...refs) {
  const refsRef = React.useRef(refs)
  refsRef.current = refs

  const lastNodeRef = React.useRef(null)
  const cleanupsRef = React.useRef([])

  return React.useCallback((node) => {
    // If the DOM node reference has not changed, do not re-run state-setting refs.
    if (lastNodeRef.current === node && cleanupsRef.current.length > 0) {
      return
    }

    // Run cleanups if node is transitioning to a different node or null
    if (cleanupsRef.current.length > 0) {
      for (let i = 0; i < cleanupsRef.current.length; i++) {
        const cleanup = cleanupsRef.current[i]
        if (typeof cleanup === 'function') {
          cleanup()
        } else {
          setRef(refsRef.current[i], null)
        }
      }
      cleanupsRef.current = []
    }

    lastNodeRef.current = node

    if (node === null) {
      return
    }

    const currentRefs = refsRef.current
    let hasCleanup = false
    const cleanups = currentRefs.map((ref) => {
      const cleanup = setRef(ref, node)
      if (!hasCleanup && typeof cleanup === 'function') {
        hasCleanup = true
      }
      return cleanup
    })

    cleanupsRef.current = cleanups

    return () => {
      for (let i = 0; i < cleanupsRef.current.length; i++) {
        const cleanup = cleanupsRef.current[i]
        if (typeof cleanup === 'function') {
          cleanup()
        } else {
          setRef(refsRef.current[i], null)
        }
      }
      cleanupsRef.current = []
      lastNodeRef.current = null
    }
  }, [])
}

export default composeRefs
