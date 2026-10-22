import * as vscode from 'vscode';
import { tdClient } from '../bridge/tdClient';

export class TouchDesignerHoverProvider implements vscode.HoverProvider {
  // Matches op('...'), parent('...'), me.op('...')
  private opHoverRegex = /(?:op|parent|me\.op|self\.op)\(\s*['"]([^'"]+)['"]\s*\)/g;

  public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    const line = document.lineAt(position.line).text;

    // Check if hovering over an op('path') call
    let match: RegExpExecArray | null;
    this.opHoverRegex.lastIndex = 0;

    while ((match = this.opHoverRegex.exec(line)) !== null) {
      const startIdx = match.index;
      const endIdx = startIdx + match[0].length;

      if (position.character >= startIdx && position.character <= endIdx) {
        const opPath = match[1];
        const range = new vscode.Range(
          new vscode.Position(position.line, startIdx),
          new vscode.Position(position.line, endIdx)
        );

        return this.createOpHover(opPath, range);
      }
    }

    return undefined;
  }

  private async createOpHover(opPath: string, range: vscode.Range): Promise<vscode.Hover | undefined> {
    if (!tdClient.isConnected) {
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`### TouchDesigner Operator: \`${opPath}\`\n\n`);
      md.appendMarkdown(`*(TouchDesigner is currently disconnected. Connect to view live status.)*`);
      return new vscode.Hover(md, range);
    }

    try {
      const details = await tdClient.getOpDetails(opPath);
      if (!details) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### \`${opPath}\`\n\n`);
        md.appendMarkdown(`⚠️ Operator not found in running TouchDesigner project.`);
        return new vscode.Hover(md, range);
      }

      const md = new vscode.MarkdownString();
      md.isTrusted = true;

      // Header with family badge
      const icon = this.getFamilyIcon(details.family);
      md.appendMarkdown(`### ${icon} \`${details.path}\`\n\n`);
      md.appendMarkdown(`**Type:** \`${details.type}\` &nbsp;|&nbsp; **Family:** \`${details.family}\`\n\n`);

      // Errors & Warnings
      if (details.error) {
        md.appendMarkdown(`> ❌ **Error:** ${details.error}\n\n`);
      }
      if (details.warning) {
        md.appendMarkdown(`> ⚠️ **Warning:** ${details.warning}\n\n`);
      }

      // Cooking stats
      const cookTime = details.cookTime !== undefined ? `${details.cookTime.toFixed(2)} ms` : 'N/A';
      md.appendMarkdown(`- **Cooking:** ${details.cooked ? 'Active' : 'Bypassed / Idle'} (Cook time: ${cookTime})\n`);
      md.appendMarkdown(`- **Parameters:** ${details.params.length} total (${details.params.filter(p => p.isCustom).length} custom)\n`);

      if (details.customMethods && details.customMethods.length > 0) {
        md.appendMarkdown(`- **Extension Methods:** ${details.customMethods.map(m => `\`${m}()\``).join(', ')}\n`);
      }

      if (details.isDat && details.datText !== undefined) {
        const lines = details.datText.split('\n').length;
        md.appendMarkdown(`- **DAT Content:** ${lines} lines (${details.datText.length} chars)\n`);
      }

      return new vscode.Hover(md, range);
    } catch {
      return undefined;
    }
  }

  private getFamilyIcon(family: string): string {
    switch (family) {
      case 'TOP':
        return '🟩';
      case 'CHOP':
        return '🟧';
      case 'DAT':
        return '🟪';
      case 'SOP':
        return '🟦';
      case 'COMP':
        return '🟫';
      case 'MAT':
        return '🟨';
      default:
        return '⚪';
    }
  }
}
