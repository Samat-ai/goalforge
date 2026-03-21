import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/react'
import api from '../lib/api'

type GetTokenFn = ReturnType<typeof useAuth>['getToken']

export default function AuthInterceptor() {
  const { getToken } = useAuth()
  const getTokenRef = useRef<GetTokenFn>(getToken)

  useEffect(() => {
    getTokenRef.current = getToken
  }, [getToken])

  useEffect(() => {
    const id = api.interceptors.request.use(async (config) => {
      const token = await getTokenRef.current?.()
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`
      }
      return config
    })

    return () => {
      api.interceptors.request.eject(id)
    }
  }, [])

  return null
}
