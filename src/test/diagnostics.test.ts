import * as vscode from 'vscode'
import * as assert from 'assert'
import { getDocUri, activate, doc } from './helper'

suite('Diagnostics', () => {
  const docUri = getDocUri('diagnostics.py')

  test('Should get diagnostics', async () => {
    await testDiagnostics(docUri, [
      {
        message: "Python list isn't supported in Algorand Python",
        range: toRange(0, 4, 0, 9),
        severity: vscode.DiagnosticSeverity.Error,
        source: 'ex',
      },
    ])
  })

  test('Should fix the issue', async () => {
    await activate(docUri)

    const range = toRange(0, 4, 0, 9)

    // Execute the code action provider command to retrieve action list.
    const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
      'vscode.executeCodeActionProvider',
      docUri,
      range,
      vscode.CodeActionKind.QuickFix.value
    )

    assert.equal(codeActions[0].title, "Replace 'list' with 'arc4.Array'")
    await vscode.workspace.applyEdit(codeActions[0]!.edit!)
    assert.equal(doc.getText(), 'a = arc4.Array([1, 2, 3])')
  })
})

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
  const start = new vscode.Position(sLine, sChar)
  const end = new vscode.Position(eLine, eChar)
  return new vscode.Range(start, end)
}

async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]) {
  await activate(docUri)

  const actualDiagnostics = vscode.languages.getDiagnostics(docUri)
  assert.equal(actualDiagnostics.length, expectedDiagnostics.length)

  expectedDiagnostics.forEach((expectedDiagnostic, i) => {
    const actualDiagnostic = actualDiagnostics[i]
    assert.equal(actualDiagnostic.message, expectedDiagnostic.message)
    assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range)
    assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity)
  })
}
