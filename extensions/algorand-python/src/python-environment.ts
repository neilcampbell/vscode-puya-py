import { Uri } from 'vscode'
import { PythonExtension } from '@vscode/python-extension'

export type PythonConfig = {
  id: string
  envPath: string
  /*
   * Path to the Python executable, undefined if no executable found
   */
  pythonPath?: string
}

export async function getPythonEnvironment(resource?: Uri): Promise<PythonConfig | undefined> {
  const api = await PythonExtension.api()
  const resolvedEnvironment = await api?.environments.resolveEnvironment(api?.environments.getActiveEnvironmentPath(resource))
  if (!resolvedEnvironment) {
    return undefined
  }

  return {
    id: resolvedEnvironment.id,
    // We don't use resolvedEnvironment.environment.folderUri.fsPath here because it won't be set for global env
    envPath: resolvedEnvironment.executable.sysPrefix,
    pythonPath: resolvedEnvironment.executable.uri?.fsPath,
  }
}
