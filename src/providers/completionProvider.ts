import * as vscode from 'vscode';
import { tdClient } from '../bridge/tdClient';
import { OpParamInfo, OpCompletionItem } from '../bridge/protocol';

export class TouchDesignerCompletionProvider implements vscode.CompletionItemProvider {
  // Regex patterns
  // Matches op('... or op("... with optional leading context
  private opPathRegex = /(?:op|parent|me\.op|self\.op)\(\s*['"]([^'"]*)$/;

  // Matches op('...').par. or op("...").par. or op('...').par.paramPrefix
  private opParRegex = /op\(\s*['"]([^'"]+)['"]\s*\)\.par\.([a-zA-Z0-9_]*)$/;

  // Matches self.par. or me.par.
  private selfParRegex = /(?:self|me)\.par\.([a-zA-Z0-9_]*)$/;

  // Matches op('...').methodPrefix
  private opMemberRegex = /op\(\s*['"]([^'"]+)['"]\s*\)\.([a-zA-Z0-9_]*)$/;

  public async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList | undefined> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    // 1. Check if user is typing an operator path inside op('...')
    const opPathMatch = linePrefix.match(this.opPathRegex);
    if (opPathMatch) {
      const typedPrefix = opPathMatch[1];
      return this.provideOpPathCompletions(typedPrefix, document, position);
    }

    // 2. Check if user is accessing parameters via op('...').par.<cursor>
    const opParMatch = linePrefix.match(this.opParRegex);
    if (opParMatch) {
      const opPath = opParMatch[1];
      const parPrefix = opParMatch[2];
      return this.provideOpParamCompletions(opPath, parPrefix);
    }

    // 3. Check if user is accessing parameters via self.par.<cursor> or me.par.<cursor>
    const selfParMatch = linePrefix.match(this.selfParRegex);
    if (selfParMatch) {
      const parPrefix = selfParMatch[1];
      // Try to resolve current OP context from document header or path
      const currentOpPath = this.detectContextOp(document);
      if (currentOpPath) {
        return this.provideOpParamCompletions(currentOpPath, parPrefix);
      }
    }

    // 4. Check if user is accessing custom extension methods: op('...').<cursor>
    const opMemberMatch = linePrefix.match(this.opMemberRegex);
    if (opMemberMatch && !opMemberMatch[2].startsWith('par')) {
      const opPath = opMemberMatch[1];
      return this.provideOpMemberCompletions(opPath);
    }

    // 5. GLSL specific completions
    if (document.languageId === 'glsl' || document.fileName.endsWith('.frag') || document.fileName.endsWith('.vert')) {
      return this.provideGLSLCompletions();
    }

    // 6. Python globals (op, me, parent, tdu, etc.) if at word start
    const wordRange = document.getWordRangeAtPosition(position);
    const currentWord = wordRange ? document.getText(wordRange) : '';
    if (currentWord.length > 0 && !linePrefix.includes('.')) {
      return this.provideGlobalCompletions();
    }

    return undefined;
  }

  /**
   * Autocompletes operator paths inside op('...')
   */
  private async provideOpPathCompletions(
    typedPrefix: string,
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.CompletionItem[]> {
    if (!tdClient.isConnected) {
      return [];
    }

    try {
      const completions = await tdClient.getOpCompletions(typedPrefix);
      const items: vscode.CompletionItem[] = [];

      for (const op of completions) {
        const item = new vscode.CompletionItem(op.path, vscode.CompletionItemKind.Reference);
        item.detail = `[${op.family}] ${op.type} (${op.path})`;

        // Badges and icons based on operator family
        const icon = this.getFamilyIcon(op.family);
        item.label = {
          label: op.path,
          description: `${icon} ${op.type}`,
        };

        const doc = new vscode.MarkdownString();
        doc.appendMarkdown(`### \`${op.path}\`\n\n`);
        doc.appendMarkdown(`- **Family:** \`${op.family}\`\n`);
        doc.appendMarkdown(`- **Type:** \`${op.type}\`\n`);
        if (op.isDat) {
          doc.appendMarkdown(`- **Category:** Text / Script DAT\n`);
        }
        item.documentation = doc;

        // Sort items: closer matches first
        item.sortText = `0_${op.path}`;
        items.push(item);
      }

      return items;
    } catch {
      return [];
    }
  }

  /**
   * Autocompletes operator parameters (e.g. op('...').par.<name>)
   */
  private async provideOpParamCompletions(
    opPath: string,
    prefix: string
  ): Promise<vscode.CompletionItem[]> {
    if (!tdClient.isConnected) {
      return [];
    }

    try {
      const { params, customMethods } = await tdClient.getOpParams(opPath);
      const items: vscode.CompletionItem[] = [];

      for (const p of params) {
        const item = new vscode.CompletionItem(
          p.name,
          p.isCustom ? vscode.CompletionItemKind.Property : vscode.CompletionItemKind.Field
        );

        const customBadge = p.isCustom ? '⭐ Custom' : 'Built-in';
        item.detail = `(${p.type}) [${p.page}] ${p.label || p.name} • ${customBadge}`;

        item.label = {
          label: p.name,
          description: `${p.type} (${p.val !== undefined ? String(p.val) : ''})`,
        };

        const doc = new vscode.MarkdownString();
        doc.appendMarkdown(`### Parameter \`${p.name}\`\n\n`);
        doc.appendMarkdown(`- **Label:** ${p.label}\n`);
        doc.appendMarkdown(`- **Page:** ${p.page}\n`);
        doc.appendMarkdown(`- **Type:** \`${p.type}\`\n`);
        doc.appendMarkdown(`- **Current Value:** \`${JSON.stringify(p.val)}\`\n`);
        if (p.isCustom) {
          doc.appendMarkdown(`- **Custom Parameter:** Yes\n`);
        }
        if (p.menuNames && p.menuNames.length > 0) {
          doc.appendMarkdown(`- **Menu Options:** ${p.menuNames.map((n, i) => `\`${n}\` (${p.menuLabels?.[i] || ''})`).join(', ')}\n`);
        }

        item.documentation = doc;
        // Prioritize custom parameters or exact prefix matches
        item.sortText = p.isCustom ? `0_${p.name}` : `1_${p.name}`;
        items.push(item);
      }

      return items;
    } catch {
      return [];
    }
  }

  /**
   * Autocompletes extension methods on COMPs
   */
  private async provideOpMemberCompletions(opPath: string): Promise<vscode.CompletionItem[]> {
    if (!tdClient.isConnected) {
      return [];
    }

    try {
      const { customMethods, customMembers } = await tdClient.getOpParams(opPath);
      const items: vscode.CompletionItem[] = [];

      for (const method of customMethods) {
        const item = new vscode.CompletionItem(method, vscode.CompletionItemKind.Method);
        item.detail = `(Extension Method) on ${opPath}`;
        item.insertText = new vscode.SnippetString(`${method}($0)`);
        item.documentation = new vscode.MarkdownString(`Custom extension method defined on COMP \`${opPath}\`.`);
        item.sortText = `0_${method}`;
        items.push(item);
      }

      for (const member of customMembers) {
        const item = new vscode.CompletionItem(member, vscode.CompletionItemKind.Variable);
        item.detail = `(Extension Member) on ${opPath}`;
        item.sortText = `1_${member}`;
        items.push(item);
      }

      return items;
    } catch {
      return [];
    }
  }

  /**
   * Global TouchDesigner Python completions
   */
  private provideGlobalCompletions(): vscode.CompletionItem[] {
    const globals = [
      {
        name: 'op',
        kind: vscode.CompletionItemKind.Function,
        snippet: "op('${1:/project1}')",
        detail: 'op(pattern, [str]) -> OP',
        doc: 'Finds an operator by path, name, or pattern. Returns an OP object or None.',
      },
      {
        name: 'me',
        kind: vscode.CompletionItemKind.Variable,
        snippet: 'me',
        detail: 'me -> OP',
        doc: 'The current operator containing this executing script.',
      },
      {
        name: 'parent',
        kind: vscode.CompletionItemKind.Function,
        snippet: 'parent(${1:1})',
        detail: 'parent(n=1) -> COMP',
        doc: 'Returns the parent COMP of the current operator. parent(2) returns grandparent.',
      },
      {
        name: 'tdu',
        kind: vscode.CompletionItemKind.Module,
        snippet: 'tdu.',
        detail: 'tdu module',
        doc: 'TouchDesigner Utilities module. Contains math, color, matrix, and helper functions.',
      },
      {
        name: 'absTime',
        kind: vscode.CompletionItemKind.Variable,
        snippet: 'absTime',
        detail: 'absTime object',
        doc: 'Absolute time since TouchDesigner started. Properties: frame, seconds, step.',
      },
      {
        name: 'app',
        kind: vscode.CompletionItemKind.Module,
        snippet: 'app.',
        detail: 'app module',
        doc: 'Application-level settings and commands (version, build, os, power, quit).',
      },
      {
        name: 'ui',
        kind: vscode.CompletionItemKind.Module,
        snippet: 'ui.',
        detail: 'ui module',
        doc: 'User interface controls, dialogs, clipboard, redraw, cursor.',
      },
      {
        name: 'project',
        kind: vscode.CompletionItemKind.Module,
        snippet: 'project.',
        detail: 'project module',
        doc: 'TouchDesigner project file controls (save, name, folder, isModified).',
      },
      {
        name: 'runs',
        kind: vscode.CompletionItemKind.Function,
        snippet: "run('${1:python_code}', delayFrames=${2:1})",
        detail: 'run(script, ...) -> Run',
        doc: 'Runs a delayed script or creates a scheduled asynchronous execution task.',
      },
    ];

    return globals.map(g => {
      const item = new vscode.CompletionItem(g.name, g.kind);
      item.insertText = new vscode.SnippetString(g.snippet);
      item.detail = g.detail;
      item.documentation = new vscode.MarkdownString(g.doc);
      return item;
    });
  }

  /**
   * Autocompletes TouchDesigner GLSL variables and built-ins
   */
  private provideGLSLCompletions(): vscode.CompletionItem[] {
    const glslItems = [
      {
        name: 'sTD2DInputs',
        kind: vscode.CompletionItemKind.Variable,
        detail: 'uniform sampler2D sTD2DInputs[]',
        doc: 'Array of 2D input textures wired into this GLSL TOP. Access input 0 via `texture(sTD2DInputs[0], vUV.st)`.',
      },
      {
        name: 'sTD3DInputs',
        kind: vscode.CompletionItemKind.Variable,
        detail: 'uniform sampler3D sTD3DInputs[]',
        doc: 'Array of 3D input textures connected to this GLSL TOP.',
      },
      {
        name: 'sTDCubeInputs',
        kind: vscode.CompletionItemKind.Variable,
        detail: 'uniform samplerCube sTDCubeInputs[]',
        doc: 'Array of Cube Map input textures connected to this GLSL TOP.',
      },
      {
        name: 'uTD2DInfos',
        kind: vscode.CompletionItemKind.Variable,
        detail: 'uniform TD2DInfo uTD2DInfos[]',
        doc: 'Information struct for 2D inputs. Members: `res.zw` (1/width, 1/height), `res.xy` (width, height), `depth`.',
      },
      {
        name: 'uTDOutputInfo',
        kind: vscode.CompletionItemKind.Variable,
        detail: 'uniform TDOutputInfo uTDOutputInfo',
        doc: 'Information about the output texture resolution and aspect ratio.',
      },
      {
        name: 'uTDGeneral',
        kind: vscode.CompletionItemKind.Variable,
        detail: 'uniform TDGeneral uTDGeneral',
        doc: 'TouchDesigner general render uniforms (near, far, fog, etc.).',
      },
      {
        name: 'TDOutputSwizzle',
        kind: vscode.CompletionItemKind.Function,
        snippet: 'TDOutputSwizzle(${1:color})',
        detail: 'vec4 TDOutputSwizzle(vec4 color)',
        doc: 'Swizzles and pre-multiplies the color based on the TOP output parameter settings. Always apply this to your final color output!',
      },
      {
        name: 'TDDeform',
        kind: vscode.CompletionItemKind.Function,
        snippet: 'TDDeform(${1:pos})',
        detail: 'vec4 TDDeform(vec4 pos)',
        doc: 'Applies GPU skeletal deformation and instance matrix transformations to the vertex position.',
      },
      {
        name: 'TDUVUnwrap',
        kind: vscode.CompletionItemKind.Function,
        snippet: 'TDUVUnwrap(${1:uv})',
        detail: 'vec2 TDUVUnwrap(vec2 uv)',
        doc: 'Handles UV unwrapping adjustments for sub-regions and flip settings in TOPs.',
      },
    ];

    return glslItems.map(g => {
      const item = new vscode.CompletionItem(g.name, g.kind);
      if (g.snippet) {
        item.insertText = new vscode.SnippetString(g.snippet);
      }
      item.detail = g.detail;
      item.documentation = new vscode.MarkdownString(g.doc);
      return item;
    });
  }

  /**
   * Resolves the current OP context if the file has a `# td: /path/to/op` header
   * or matches a known DAT path.
   */
  private detectContextOp(document: vscode.TextDocument): string | null {
    // Check first 3 lines for a comment like `# td: /project1/my_op`
    const lineCount = Math.min(3, document.lineCount);
    for (let i = 0; i < lineCount; i++) {
      const line = document.lineAt(i).text;
      const match = line.match(/#\s*(?:td|op):\s*([/\w_]+)/i);
      if (match) {
        return match[1];
      }
    }
    return null;
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
