import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../../src/components/Header';

describe('Header component', () => {
  it('renders application branding and version badge', () => {
    render(
      <Header
        onLoadSample={vi.fn()}
        onFileUpload={vi.fn()}
        onImportJson={vi.fn()}
        onExportClick={vi.fn()}
        onClearAll={vi.fn()}
        onToggleShortcuts={vi.fn()}
        hasMedia={false}
        redactionCount={0}
      />
    );

    expect(screen.getByText('CANVAS-REDACT')).toBeInTheDocument();
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
  });

  it('triggers sample video generation on button click', () => {
    const onLoadSample = vi.fn();
    render(
      <Header
        onLoadSample={onLoadSample}
        onFileUpload={vi.fn()}
        onImportJson={vi.fn()}
        onExportClick={vi.fn()}
        onClearAll={vi.fn()}
        onToggleShortcuts={vi.fn()}
        hasMedia={false}
        redactionCount={0}
      />
    );

    const sampleBtn = screen.getByRole('button', { name: /demo/i });
    fireEvent.click(sampleBtn);
    expect(onLoadSample).toHaveBeenCalled();
  });

  it('disables export button when no redactions are present', () => {
    const onExportClick = vi.fn();
    render(
      <Header
        onLoadSample={vi.fn()}
        onFileUpload={vi.fn()}
        onImportJson={vi.fn()}
        onExportClick={onExportClick}
        onClearAll={vi.fn()}
        onToggleShortcuts={vi.fn()}
        hasMedia={true}
        redactionCount={0}
      />
    );

    const exportBtn = screen.getByRole('button', { name: /Export evidence JSON/i });
    expect(exportBtn).toBeDisabled();
    fireEvent.click(exportBtn);
    expect(onExportClick).not.toHaveBeenCalled();
  });

  it('enables export button and triggers callback when annotations exist', () => {
    const onExportClick = vi.fn();
    render(
      <Header
        onLoadSample={vi.fn()}
        onFileUpload={vi.fn()}
        onImportJson={vi.fn()}
        onExportClick={onExportClick}
        onClearAll={vi.fn()}
        onToggleShortcuts={vi.fn()}
        hasMedia={true}
        redactionCount={3}
      />
    );

    const exportBtn = screen.getByRole('button', { name: /Export evidence JSON with 3 annotations/i });
    expect(exportBtn).toBeEnabled();
    fireEvent.click(exportBtn);
    expect(onExportClick).toHaveBeenCalled();
  });

  it('triggers clear all callback when Clear button is clicked', () => {
    const onClearAll = vi.fn();
    render(
      <Header
        onLoadSample={vi.fn()}
        onFileUpload={vi.fn()}
        onImportJson={vi.fn()}
        onExportClick={vi.fn()}
        onClearAll={onClearAll}
        onToggleShortcuts={vi.fn()}
        hasMedia={true}
        redactionCount={2}
      />
    );

    const clearBtn = screen.getByRole('button', { name: /Clear all current redaction annotations/i });
    fireEvent.click(clearBtn);
    expect(onClearAll).toHaveBeenCalled();
  });

  it('handles local file input change', () => {
    const onFileUpload = vi.fn();
    render(
      <Header
        onLoadSample={vi.fn()}
        onFileUpload={onFileUpload}
        onImportJson={vi.fn()}
        onExportClick={vi.fn()}
        onClearAll={vi.fn()}
        onToggleShortcuts={vi.fn()}
        hasMedia={false}
        redactionCount={0}
      />
    );

    const file = new File(['mock content'], 'incident_01.mp4', { type: 'video/mp4' });
    const input = screen.getByLabelText(/Upload evidence video file/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileUpload).toHaveBeenCalledWith(file);
  });

  it('renders Import JSON button and triggers manifest input', () => {
    render(
      <Header
        onLoadSample={vi.fn()}
        onFileUpload={vi.fn()}
        onImportJson={vi.fn()}
        onExportClick={vi.fn()}
        onClearAll={vi.fn()}
        onToggleShortcuts={vi.fn()}
        hasMedia={true}
        redactionCount={0}
      />
    );

    const importBtn = screen.getByRole('button', { name: /Import evidence review JSON manifest/i });
    expect(importBtn).toBeInTheDocument();
    const manifestInput = screen.getByLabelText(/Upload evidence review JSON manifest file/i) as HTMLInputElement;
    expect(manifestInput).toBeInTheDocument();
  });
});
