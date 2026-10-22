import * as vscode from 'vscode';
import { tdClient } from '../bridge/tdClient';
import { textport } from '../bridge/textportStream';

export class ExecuteCodeManager {
  /**
   * Evaluates the selected code (or current line) in TouchDesigner
   */
  public static async executeSelection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    if (!tdClient.isConnected) {
      vscode.window.showWarningMessage('TouchDesigner is not connected. Use "Connect to TouchDesigner" first.');
      return;
    }

    const document = editor.document;
    const selection = editor.selection;

    let codeToRun = '';
    let isSingleLine = false;

    if (!selection.isEmpty) {
      codeToRun = document.getText(selection);
    } else {
      // Execute active line and move cursor down to next line
      const currentLine = document.lineAt(selection.active.line);
      codeToRun = currentLine.text;
      isSingleLine = true;

      // Move cursor to next line
      if (selection.active.line < document.lineCount - 1) {
        const nextPosition = new vscode.Position(selection.active.line + 1, selection.active.character);
        editor.selection = new vscode.Selection(nextPosition, nextPosition);
      }
    }

    if (!codeToRun.trim()) {
      return;
    }

    const contextOp = ExecuteCodeManager.extractContextOp(document);
    const startTime = Date.now();

    try {
      const res = await tdClient.evalCode(codeToRun, contextOp);
      const durationMs = Date.now() - startTime;

      textport.logEvalResult(codeToRun, res.success, res.result, res.stdout, res.stderr, durationMs);

      if (res.success) {
        let msg = `✓ Executed in ${durationMs}ms`;
        if (res.result !== undefined && res.result !== null && res.result !== '') {
          const resPreview = String(res.result).replace(/\n/g, ' ').substring(0, 40);
          msg += ` → ${resPreview}`;
        }
        vscode.window.setStatusBarMessage(msg, 3000);
      } else {
        vscode.window.setStatusBarMessage(`✗ Error: ${res.error || 'Execution failed'}`, 4000);
      }
    } catch (err: any) {
      textport.logEvalResult(codeToRun, false, err.message, '', '', Date.now() - startTime);
      vscode.window.showErrorMessage(`Execution failed: ${err.message}`);
    }
  }

  /**
   * Evaluates the entire file in TouchDesigner
   */
  public static async executeFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    if (!tdClient.isConnected) {
      vscode.window.showWarningMessage('TouchDesigner is not connected.');
      return;
    }

    const document = editor.document;
    const code = document.getText();
    if (!code.trim()) {
      return;
    }

    const contextOp = ExecuteCodeManager.extractContextOp(document);
    const startTime = Date.now();

    try {
      const res = await tdClient.evalCode(code, contextOp);
      const durationMs = Date.now() - startTime;

      textport.logEvalResult(
        `[File: ${document.fileName}]`,
        res.success,
        res.result,
        res.stdout,
        res.stderr,
        durationMs
      );

      if (res.success) {
        vscode.window.setStatusBarMessage(`✓ File executed successfully (${durationMs}ms)`, 3000);
      } else {
        vscode.window.setStatusBarMessage(`✗ File execution error: ${res.error || 'Failed'}`, 4000);
      }
    } catch (err: any) {
      textport.logEvalResult(document.fileName, false, err.message, '', '', Date.now() - startTime);
      vscode.window.showErrorMessage(`Execution error: ${err.message}`);
    }
  }

  /**
   * Helper to detect context OP from file header `# td: /path/to/op`
   */
  private static extractContextOp(document: vscode.TextDocument): string | undefined {
    const lineCount = Math.min(3, document.lineCount);
    for (let i = 0; i < lineCount; i++) {
      const line = document.lineAt(i).text;
      const match = line.match(/^(?:#|\/\/)\s*td:\s*([/\w_]+)/i);
      if (match) {
        return match[1];
      }
    }
    return undefined;
  }
}
