export function ok<T>(payload: T): Response {
  return Response.json(payload, { status: 200 })
}

export function created<T>(payload: T): Response {
  return Response.json(payload, { status: 201 })
}

export function noContent(): Response {
  return new Response(null, { status: 204 })
}
