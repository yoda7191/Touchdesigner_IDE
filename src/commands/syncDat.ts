import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { tdClient } from '../bridge/tdClient';
import { textport } from '../bridge/textportStream';

export class DatSyncManager {
  // Map of file URI string -> TouchDesigner OP path
  private syncedFiles: Map<string, string> = new Map();

  constructor(private context: vscode.ExtensionContext) {
    // Listen for file save events to auto-sync back to TouchDesigner
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(async (document) => {
        await this.handleFileSaved(document);
      })
    );
  }

  /**
   * Ensures a DAT from TouchDesigner is synced to disk and returns its file Uri
   */
  public async ensureDatFile(opPath: string): Promise<vscode.Uri | null> {
    if (!tdClient.isConnected) {
      return null;
    }

    try {
      const { content, isTable } = await tdClient.fetchDat(opPath);

      let ext = '.py';
      if (isTable) {
        ext = '.tsv';
      } else if (opPath.endsWith('_vert') || opPath.includes('vert')) {
        ext = '.vert';
      } else if (opPath.endsWith('_frag') || opPath.includes('pixel') || opPath.includes('frag')) {
        ext = '.frag';
      } else if (opPath.endsWith('.glsl')) {
        ext = '.glsl';
      } else if (opPath.endsWith('.json')) {
        ext = '.json';
      } else if (opPath.endsWith('.xml')) {
        ext = '.xml';
      }

      const safeName = opPath.replace(/^\//, '').replace(/\//g, '_');
      const filename = `${safeName}${ext}`;

      let targetDir: string;
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        targetDir = path.join(workspaceFolder.uri.fsPath, '.td_sync');
      } else {
        targetDir = path.join(this.context.globalStorageUri.fsPath, 'dats');
      }

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, filename);

      let fileContent = content;
      if (ext === '.py' && !fileContent.startsWith('# td:')) {
        fileContent = `# td: ${opPath}\n# Auto-synced with TouchDesigner\n\n${fileContent}`;
      } else if ((ext === '.frag' || ext === '.vert' || ext === '.glsl') && !fileContent.startsWith('// td:')) {
        fileContent = `// td: ${opPath}\n// Auto-synced with TouchDesigner\n\n${fileContent}`;
      }

      fs.writeFileSync(filePath, fileContent, 'utf-8');

      const fileUri = vscode.Uri.file(filePath);
      this.syncedFiles.set(fileUri.toString(), opPath);
      return fileUri;
    } catch {
      return null;
    }
  }

  /**
   * Opens a DAT from TouchDesigner in the editor
   */
  public async openDatInEditor(opPath: string) {
    if (!tdClient.isConnected) {
      vscode.window.showWarningMessage('Please connect to TouchDesigner first.');
      return;
    }

    try {
      const fileUri = await this.ensureDatFile(opPath);
      if (!fileUri) {
        throw new Error(`Unable to fetch DAT content for ${opPath}`);
      }

      // Open in editor
      const doc = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(doc, { preview: false });

      vscode.window.setStatusBarMessage(`Opened ${opPath} from TouchDesigner`, 3000);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to open DAT '${opPath}': ${err.message}`);
    }
  }

  /**
   * Triggered when a document is saved
   */
  private async handleFileSaved(document: vscode.TextDocument) {
    if (!tdClient.isConnected) {
      return;
    }

    const uriStr = document.uri.toString();
    let opPath = this.syncedFiles.get(uriStr);

    // If not in map, inspect file header for `# td: /path` or `// td: /path`
    if (!opPath && document.lineCount > 0) {
      const firstLine = document.lineAt(0).text;
      const match = firstLine.match(/^(?:#|\/\/)\s*td:\s*([/\w_]+)/i);
      if (match) {
        opPath = match[1];
        this.syncedFiles.set(uriStr, opPath);
      }
    }

    if (!opPath) {
      return;
    }

    // Strip auto-generated header lines before sending back to TD DAT
    let text = document.getText();
    const lines = text.split('\n');
    let cleanLines = [...lines];

    if (cleanLines.length > 0 && cleanLines[0].match(/^(?:#|\/\/)\s*td:/i)) {
      cleanLines.shift(); // remove header
      if (cleanLines.length > 0 && cleanLines[0].match(/^(?:#|\/\/)\s*Auto-synced/i)) {
        cleanLines.shift(); // remove sub-header
      }
      if (cleanLines.length > 0 && cleanLines[0].trim() === '') {
        cleanLines.shift(); // remove blank line
      }
      text = cleanLines.join('\n');
    }

    try {
      const success = await tdClient.syncDat(opPath, text);
      if (success) {
        vscode.window.setStatusBarMessage(`$(check) Synced to TouchDesigner: ${opPath}`, 2500);
        textport.log(`Synced changes to TouchDesigner DAT: ${opPath}`, 'SYNC');
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to sync to TouchDesigner DAT '${opPath}': ${err.message}`);
    }
  }
}
