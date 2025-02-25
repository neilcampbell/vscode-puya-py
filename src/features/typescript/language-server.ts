import { window } from 'vscode'
import { WorkspaceFolder } from 'vscode'
import {
  createClientSocketTransport,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node'
import { startedInDebugMode } from '../../utils/started-in-debug-mode'

const clients: Map<string, LanguageClient> = new Map()

export async function startLanguageServer(workspaceFolder: WorkspaceFolder) {
  if (clients.has(workspaceFolder.name)) {
    return
  }

  const serverOptions: ServerOptions = startedInDebugMode()
    ? async () => {
        const transport = await createClientSocketTransport(8888)
        const protocol = await transport.onConnected()
        return { reader: protocol[0], writer: protocol[1] }
      }
    : {
        command: 'npx',
        args: ['run-language-server'],
        transport: TransportKind.stdio,
        options: {
          cwd: workspaceFolder.uri.fsPath,
          shell: true,
        },
      }

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      {
        language: 'typescript',
        pattern: `${workspaceFolder.uri.fsPath}/**/*`,
      },
    ],
    workspaceFolder: workspaceFolder,
  }

  const client = new LanguageClient(
    `pupats-${workspaceFolder.name}`,
    `PuyaTS Language Server - ${workspaceFolder.name}`,
    serverOptions,
    clientOptions
  )

  try {
    // Start the client. This will also launch the server
    await client.start()
    clients.set(workspaceFolder.name, client)
  } catch {
    window.showErrorMessage('Failed to start PuyaTS language server.')
  }
}

export async function restartLanguageServer(workspaceFolder: WorkspaceFolder) {
  const client = clients.get(workspaceFolder.name)
  if (client) {
    await client.stop()
    clients.delete(workspaceFolder.name)
  }

  await startLanguageServer(workspaceFolder)
}

export async function stopAllLanguageServers(): Promise<void> {
  const promises = Array.from(clients.values()).map((client) => client.stop())
  await Promise.all(promises)
  clients.clear()
}
