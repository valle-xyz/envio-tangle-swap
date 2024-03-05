import { createPublicClient, http } from 'viem'

export const viemClient = createPublicClient({
  transport: http('http://127.0.0.1:3113', {
    retryCount: 3,
    retryDelay: 250
  })
})
