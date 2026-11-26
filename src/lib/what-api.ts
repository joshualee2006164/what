import { getAuthToken } from 'deepspace'

export type ActionResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

export async function callWhatAction<T = unknown>(
  name: string,
  params: Record<string, unknown>,
): Promise<ActionResponse<T>> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Sign in to continue.', code: 'not_signed_in' }
  return requestWhatAction<T>(name, params, token)
}

export async function callWhatPublicAction<T = unknown>(
  name: string,
  params: Record<string, unknown>,
): Promise<ActionResponse<T>> {
  const token = await getAuthToken()
  return requestWhatAction<T>(name, params, token)
}

async function requestWhatAction<T>(
  name: string,
  params: Record<string, unknown>,
  token: string | null,
): Promise<ActionResponse<T>> {
  try {
    const response = await fetch(`/api/actions/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params),
    })
    const result = await response.json() as ActionResponse<T>
    if (!response.ok && result.success) return { success: false, error: 'That request could not be completed.' }
    return result
  } catch {
    return { success: false, error: 'Connection hiccup. Please try again.' }
  }
}
