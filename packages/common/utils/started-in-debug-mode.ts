// export function startedInDebugMode(): boolean {
//   const debugStartWith: string[] = ['--debug=', '--debug-brk=', '--inspect=', '--inspect-brk=']
//   const debugEquals: string[] = ['--debug', '--debug-brk', '--inspect', '--inspect-brk']
//   const args: string[] = process.execArgv
//   if (args) {
//     return args.some((arg) => {
//       return debugStartWith.some((value) => arg.startsWith(value)) || debugEquals.some((value) => arg === value)
//     })
//   }
//   return false
// }

// TODO: NC - Fix this
export function startedInDebugMode() {
  return false
}
