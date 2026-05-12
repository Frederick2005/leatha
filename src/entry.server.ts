import { createRequestHandler } from '@tanstack/react-start/server'
import { handleRequest } from '@tanstack/react-start/cloudflare'

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    return handleRequest({
      request,
      env,
      ctx,
      handler: createRequestHandler(),
    })
  },
}