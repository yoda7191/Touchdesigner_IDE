import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TouchDesignerDetector } from '../utils/tdDetector';

export class SetupPythonManager {
  /**
   * Configures VS Code settings to point to TouchDesigner's Python interpreter and TDI stubs
   */
  public static async configureWorkspaceEnvironment() {
    const env = TouchDesignerDetector.detectEnvironment();

    if (!env) {
      const selected = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: 'Select TouchDesigner Python Executable',
        title: 'Locate TouchDesigner Python Executable',
      });

      if (!selected || selected.length === 0) {
        return;
      }

      await SetupPythonManager.applySettings(selected[0].fsPath, undefined);
      return;
    }

    const confirm = await vscode.window.showInformationMessage(
      `Found ${env.versionName} at:\n${env.pythonPath}\n\nWould you like to configure this workspace for TouchDesigner Python & TDI stubs?`,
      'Configure Workspace',
      'Cancel'
    );

    if (confirm !== 'Configure Workspace') {
      return;
    }

    await SetupPythonManager.applySettings(env.pythonPath, env.sitePackagesPath);
  }

  private static async applySettings(pythonPath: string, sitePackagesPath?: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('Please open a workspace folder first to configure Python settings.');
      return;
    }

    const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
    const settingsPath = path.join(vscodeDir, 'settings.json');

    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    let settings: any = {};
    if (fs.existsSync(settingsPath)) {
      try {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        settings = JSON.parse(raw);
      } catch {
        settings = {};
      }
    }

    // Configure Python Interpreter
    settings['python.defaultInterpreterPath'] = pythonPath;

    // Configure extraPaths for Pylance analysis
    const extraPaths: string[] = settings['python.analysis.extraPaths'] || [];
    if (sitePackagesPath && !extraPaths.includes(sitePackagesPath)) {
      extraPaths.push(sitePackagesPath);
    }
    settings['python.analysis.extraPaths'] = extraPaths;

    const autoPaths: string[] = settings['python.autoComplete.extraPaths'] || [];
    if (sitePackagesPath && !autoPaths.includes(sitePackagesPath)) {
      autoPaths.push(sitePackagesPath);
    }
    settings['python.autoComplete.extraPaths'] = autoPaths;

    // Add python.analysis.typeCheckingMode to basic or off so TouchDesigner dynamic variables don't spam errors
    if (!settings['python.analysis.typeCheckingMode']) {
      settings['python.analysis.typeCheckingMode'] = 'basic';
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

    vscode.window.showInformationMessage(
      `✓ TouchDesigner Python environment configured! Pylance will now provide official TDI autocompletion.`
    );
  }
}
