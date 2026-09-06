import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import App from '../../src/App';

describe('Agent Governance & Compliance Invariants', () => {
  const rootDir = path.resolve(__dirname, '../../');

  it('verifies that .gitignore shields all agent files and AI configs', () => {
    const gitignorePath = path.join(rootDir, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);

    const content = fs.readFileSync(gitignorePath, 'utf-8');
    expect(content).toContain('.agents/');
    expect(content).toContain('AGENTS.md');
    expect(content).toContain('agents.md');
    expect(content).toContain('.cursor/');
    expect(content).toContain('.windsurf/');
    expect(content).toContain('CLAUDE.md');
  });

  it('verifies that all architecture blueprints exist in .agents/architecture/', () => {
    const archDir = path.join(rootDir, '.agents/architecture');
    expect(fs.existsSync(archDir)).toBe(true);

    const expectedBlueprints = [
      'SYSTEM_ARCHITECTURE.md',
      'CANVAS_ENGINE.md',
      'DATA_MODELS_AND_EXPORT.md',
      'TESTING_STRATEGY.md',
    ];

    for (const blueprint of expectedBlueprints) {
      const blueprintPath = path.join(archDir, blueprint);
      expect(fs.existsSync(blueprintPath), `Missing blueprint: ${blueprint}`).toBe(true);
      const text = fs.readFileSync(blueprintPath, 'utf-8');
      expect(text.length).toBeGreaterThan(100);
      expect(text).toContain('# ');
    }
  });

  it('asserts that zero em dashes exist across repository markdown and governance files', () => {
    const filesToAudit = [
      path.join(rootDir, 'AGENTS.md'),
      path.join(rootDir, '.agents/AGENTS.md'),
      path.join(rootDir, '.agents/architecture/SYSTEM_ARCHITECTURE.md'),
      path.join(rootDir, '.agents/architecture/CANVAS_ENGINE.md'),
      path.join(rootDir, '.agents/architecture/DATA_MODELS_AND_EXPORT.md'),
      path.join(rootDir, '.agents/architecture/TESTING_STRATEGY.md'),
    ];

    for (const filePath of filesToAudit) {
      if (fs.existsSync(filePath)) {
        const text = fs.readFileSync(filePath, 'utf-8');
        expect(text).not.toContain('—');
      }
    }
  });

  it('verifies that index.html contains JSON-LD structured data and SEO tags for Lighthouse 100 & AI ranking', () => {
    const indexPath = path.join(rootDir, 'index.html');
    expect(fs.existsSync(indexPath)).toBe(true);

    const html = fs.readFileSync(indexPath, 'utf-8');
    expect(html).toContain('lang="en"');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type": "WebApplication"');
    expect(html).toContain('name="description"');
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('name="theme-color"');
  });

  it('renders initial App component shell without errors', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /canvas-redact/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });
});
