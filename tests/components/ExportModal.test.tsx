import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportModal } from '../../src/components/ExportModal';
import { ExportPayload } from '../../src/types';

describe('ExportModal component', () => {
  const samplePayload: ExportPayload = {
    version: '1.0.0',
    metadata: {
      source: 'canvas-redact',
      videoName: 'incident_cam4.mp4',
      durationMs: 12000,
      dimensions: { width: 1920, height: 1080 },
      fps: 30,
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
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ExportModal isOpen={false} onClose={vi.fn()} payload={samplePayload} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal dialog and JSON code viewer when isOpen is true', () => {
    render(<ExportModal isOpen={true} onClose={vi.fn()} payload={samplePayload} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Evidence Review Manifest/i)).toBeInTheDocument();
    expect(screen.getByText(/"version": "1.0.0"/i)).toBeInTheDocument();
    expect(screen.getByText(/"videoName": "incident_cam4.mp4"/i)).toBeInTheDocument();
  });

  it('copies JSON to clipboard and toggles feedback text', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy
      }
    });

    render(<ExportModal isOpen={true} onClose={vi.fn()} payload={samplePayload} />);

    const copyBtn = screen.getByRole('button', { name: /Copy JSON code to clipboard/i });
    fireEvent.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith(JSON.stringify(samplePayload, null, 2));
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });

  it('triggers download and closes on close button and Escape key', () => {
    const onClose = vi.fn();
    render(<ExportModal isOpen={true} onClose={onClose} payload={samplePayload} />);

    // Close button
    const closeBtn = screen.getByRole('button', { name: /Close export dialog/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('triggers onSwitchToImport and closes modal when import manifest link is clicked', () => {
    const onClose = vi.fn();
    const onSwitchToImport = vi.fn();
    render(
      <ExportModal
        isOpen={true}
        onClose={onClose}
        payload={samplePayload}
        onSwitchToImport={onSwitchToImport}
      />
    );

    const switchBtn = screen.getByRole('button', { name: /Import manifest instead/i });
    fireEvent.click(switchBtn);

    expect(onClose).toHaveBeenCalled();
    expect(onSwitchToImport).toHaveBeenCalled();
  });
});
