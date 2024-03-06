import { createPublicClient, http } from 'viem'

export const viemClient = createPublicClient({
  transport: http('https://archive.evm.shimmer.network/v1/chains/smr1prxvwqvwf7nru5q5xvh5thwg54zsm2y4wfnk6yk56hj3exxkg92mx20wl3s/evm', {
    retryCount: 5,
    retryDelay: 250
  })
})
