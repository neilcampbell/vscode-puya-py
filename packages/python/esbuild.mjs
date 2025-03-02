import { main } from '../../esbuild.mjs'

main().catch((e) => {
  // eslint-disable-next-line no-undef
  console.error(e)
  // eslint-disable-next-line no-undef
  process.exit(1)
})
