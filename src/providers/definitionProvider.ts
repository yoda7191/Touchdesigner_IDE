import * as vscode from 'vscode';
import * as fs from 'fs';
import { tdClient } from '../bridge/tdClient';
import { DatSyncManager } from '../commands/syncDat';

export class TouchDesignerDefinitionProvider implements vscode.DefinitionProvider {
  private opCallRegex = /(?:op|parent|me\.op|self\.op)\(\s*['"]([^'"]+)['"]\s*\)/g;
  private opMethodRegex = /(?:op|parent|me\.op|self\.op)\(\s*['"]([^'"]+)['"]\s*\)\.([a-zA-Z_]\w*)/g;

  constructor(private datSyncManager: DatSyncManager) {}

  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Definition | vscode.LocationLink[] | undefined> {
    if (!tdClient.isConnected) {
      return undefined;
    }

    const lineText = document.lineAt(position.line).text;

    // 1. Check if clicking on an extension method: op('comp').myMethod
    let methodMatch: RegExpExecArray | null;
    this.opMethodRegex.lastIndex = 0;
    while ((methodMatch = this.opMethodRegex.exec(lineText)) !== null) {
      const startIdx = methodMatch.index;
      const endIdx = startIdx + methodMatch[0].length;
      if (position.character >= startIdx && position.character <= endIdx) {
        const opPath = methodMatch[1];
        const methodName = methodMatch[2];

        // Check if cursor is on the method part or the op part
        const methodStart = endIdx - methodName.length;
        if (position.character >= methodStart) {
          return this.resolveMethodDefinition(opPath, methodName);
        } else {
          return this.resolveOpDefinition(opPath);
        }
      }
    }

    // 2. Check if clicking on an operator path: op('/project1/dat1')
    let opMatch: RegExpExecArray | null;
    this.opCallRegex.lastIndex = 0;
    while ((opMatch = this.opCallRegex.exec(lineText)) !== null) {
      const startIdx = opMatch.index;
      const endIdx = startIdx + opMatch[0].length;
      if (position.character >= startIdx && position.character <= endIdx) {
        const opPath = opMatch[1];
        return this.resolveOpDefinition(opPath);
      }
    }

    return undefined;
  }

  /**
   * Resolves definition of a DAT or operator
   */
  private async resolveOpDefinition(opPath: string): Promise<vscode.Location | undefined> {
    try {
      const details = await tdClient.getOpDetails(opPath);
      if (!details) {
        return undefined;
      }

      // If it's a DAT, open/sync the file and jump to top
      if (details.isDat) {
        const fileUri = await this.datSyncManager.ensureDatFile(opPath);
        if (fileUri) {
          return new vscode.Location(fileUri, new vscode.Position(0, 0));
        }
      }

      // If it's a COMP with extensions, jump to its primary extension DAT
      if (details.family === 'COMP') {
        const extDatPath = `${opPath}/ext1` || `${opPath}/${details.name}Ext`;
        const fileUri = await this.datSyncManager.ensureDatFile(extDatPath);
        if (fileUri) {
          return new vscode.Location(fileUri, new vscode.Position(0, 0));
        }
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Resolves definition of a method on an extension COMP
   */
  private async resolveMethodDefinition(opPath: string, methodName: string): Promise<vscode.Location | undefined> {
    try {
      // Find candidate extension DAT paths for this COMP
      const candidates = [
        `${opPath}/ext1`,
        `${opPath}/${opPath.split('/').pop()}Ext`,
        `${opPath}/callbacks`,
        `${opPath}/extension`,
      ];

      for (const candPath of candidates) {
        const fileUri = await this.datSyncManager.ensureDatFile(candPath);
        if (fileUri && fs.existsSync(fileUri.fsPath)) {
          const content = fs.readFileSync(fileUri.fsPath, 'utf-8');
          const lines = content.split('\n');

          const defRegex = new RegExp(`^\\s*def\\s+${methodName}\\s*\\(`, 'm');
          for (let i = 0; i < lines.length; i++) {
            if (defRegex.test(lines[i])) {
              const charIdx = lines[i].indexOf(methodName);
              return new vscode.Location(fileUri, new vscode.Position(i, Math.max(0, charIdx)));
            }
          }
        }
      }

      // If not in standard extension DAT names, fall back to opening the OP itself
      return this.resolveOpDefinition(opPath);
    } catch {
      return undefined;
    }
  }
}

