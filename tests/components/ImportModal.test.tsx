import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportModal } from '../../src/components/ImportModal';

describe('ImportModal component', () => {
  const sampleValidManifest = JSON.stringify({
    version: '1.0.0',
    metadata: {
      source: 'canvas-redact',
      videoName: 'bodycam_incident_04.mp4',
      durationMs: 14200,
      dimensions: { width: 1920, height: 1080 },
      fps: 30,
      reviewerId: 'OFC-8821',
      exportedAt: '2026-09-06T12:00:00.000Z'
    },
    redactions: [
      {
        id: 'redact-1',
        label: 'Suspect Face',
        type: 'blur',
        startMs: 1000,
        endMs: 5000,
        bbox: [0.1, 0.2, 0.3, 0.4]
      },
      {
        id: 'redact-2',
        label: 'License Plate',
        type: 'pixelate',
        startMs: 2000,
        endMs: 6000,
        bbox: [0.5, 0.5, 0.2, 0.1],
        aiAssisted: true,
        keyframes: [
          { timeMs: 2000, bbox: [0.5, 0.5, 0.2, 0.1] },
          { timeMs: 4000, bbox: [0.55, 0.52, 0.2, 0.1] }
        ]
      },
      {
        id: 'redact-3',
        label: 'Sensitive Document',
        type: 'blackout',
        startMs: 3000,
        endMs: 7000,
        bbox: [0.7, 0.1, 0.15, 0.15]
      }
    ]
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ImportModal isOpen={false} onClose={vi.fn()} onImport={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal dialog and elements when isOpen is true', () => {
    render(<ImportModal isOpen={true} onClose={vi.fn()} onImport={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Import Evidence Review Manifest/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Upload File/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Paste JSON/i })).toBeInTheDocument();
  });

  it('switches between Upload File and Paste JSON tabs', () => {
    render(<ImportModal isOpen={true} onClose={vi.fn()} onImport={vi.fn()} />);

    const pasteTab = screen.getByRole('tab', { name: /Paste JSON/i });
    fireEvent.click(pasteTab);

    expect(screen.getByLabelText(/Paste JSON Manifest Payload:/i)).toBeInTheDocument();

    const fileTab = screen.getByRole('tab', { name: /Upload File/i });
    fireEvent.click(fileTab);

    expect(screen.getByText(/Drag and drop .json manifest file here/i)).toBeInTheDocument();
  });

  it('validates valid pasted JSON and displays live preview card with pills', async () => {
    const onImport = vi.fn().mockReturnValue(true);
    const onClose = vi.fn();

    render(
      <ImportModal
        isOpen={true}
        onClose={onClose}
        onImport={onImport}
        existingCount={0}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Paste JSON/i }));
    const textarea = screen.getByLabelText(/Paste JSON Manifest Payload:/i);
    fireEvent.change(textarea, { target: { value: sampleValidManifest } });

    expect(await screen.findByText(/Valid v1.0.0 Evidence Review Manifest/i)).toBeInTheDocument();
    expect(screen.getAllByText(/bodycam_incident_04.mp4/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Reviewer: OFC-8821/i)).toBeInTheDocument();
    expect(screen.getByText(/3 Redactions/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Blur/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Pixelate/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Blackout/i)).toBeInTheDocument();
    expect(screen.getByText(/2 Keyframes/i)).toBeInTheDocument();
    expect(screen.getByText(/AI-Assisted/i)).toBeInTheDocument();

    const applyBtn = screen.getByRole('button', { name: /Apply Redactions \(3\)/i });
    expect(applyBtn).not.toBeDisabled();

    fireEvent.click(applyBtn);
    expect(onImport).toHaveBeenCalledWith(sampleValidManifest, 'replace');
    expect(onClose).toHaveBeenCalled();
  });

  it('displays error banner when invalid JSON or schema violation is pasted', async () => {
    render(<ImportModal isOpen={true} onClose={vi.fn()} onImport={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: /Paste JSON/i }));
    const textarea = screen.getByLabelText(/Paste JSON Manifest Payload:/i);

    // Invalid JSON syntax
    fireEvent.change(textarea, { target: { value: '{ invalid json' } });
    expect(await screen.findByText(/Invalid Evidence Manifest/i)).toBeInTheDocument();

    const applyBtn = screen.getByRole('button', { name: /Apply Redactions/i });
    expect(applyBtn).toBeDisabled();

    // Valid JSON but missing metadata block
    fireEvent.change(textarea, { target: { value: JSON.stringify({ version: '1.0.0' }) } });
    expect(await screen.findByText(/Missing or invalid "metadata" block/i)).toBeInTheDocument();
  });

  it('handles conflict resolution mode (merge vs replace) when existingCount > 0', async () => {
    const onImport = vi.fn().mockReturnValue(true);
    const onClose = vi.fn();

    render(
      <ImportModal
        isOpen={true}
        onClose={onClose}
        onImport={onImport}
        existingCount={4}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Paste JSON/i }));
    const textarea = screen.getByLabelText(/Paste JSON Manifest Payload:/i);
    fireEvent.change(textarea, { target: { value: sampleValidManifest } });

    expect(await screen.findByText(/Import Conflict Resolution:/i)).toBeInTheDocument();
    expect(screen.getByText(/Keep 4 existing and append 3 new/i)).toBeInTheDocument();

    // Switch to Replace All
    const replaceBtn = screen.getByRole('button', { name: /Replace All/i });
    fireEvent.click(replaceBtn);

    const applyBtn = screen.getByRole('button', { name: /Apply Redactions \(3\)/i });
    fireEvent.click(applyBtn);

    expect(onImport).toHaveBeenCalledWith(sampleValidManifest, 'replace');
    expect(onClose).toHaveBeenCalled();
  });

  it('handles merge mode correctly when selected', async () => {
    const onImport = vi.fn().mockReturnValue(true);
    const onClose = vi.fn();

    render(
      <ImportModal
        isOpen={true}
        onClose={onClose}
        onImport={onImport}
        existingCount={2}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Paste JSON/i }));
    const textarea = screen.getByLabelText(/Paste JSON Manifest Payload:/i);
    fireEvent.change(textarea, { target: { value: sampleValidManifest } });

    await screen.findByText(/Import Conflict Resolution:/i);

    // Merge is default when existingCount > 0
    const applyBtn = screen.getByRole('button', { name: /Apply Redactions \(3\)/i });
    fireEvent.click(applyBtn);

    expect(onImport).toHaveBeenCalledWith(sampleValidManifest, 'merge');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Close button, Cancel button, and Escape key', () => {
    const onClose = vi.fn();
    render(<ImportModal isOpen={true} onClose={onClose} onImport={vi.fn()} />);

    // Close button (X)
    fireEvent.click(screen.getByRole('button', { name: /Close import dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Cancel button
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(2);

    // Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('reads file when selected through file input', async () => {
    const onImport = vi.fn().mockReturnValue(true);
    render(<ImportModal isOpen={true} onClose={vi.fn()} onImport={onImport} />);

    const file = new File([sampleValidManifest], 'evidence.json', { type: 'application/json' });
    const fileInput = document.getElementById('modal-file-upload-input') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Valid v1.0.0 Evidence Review Manifest/i)).toBeInTheDocument();
    });
    expect(screen.getByText('evidence.json')).toBeInTheDocument();
  });
});
