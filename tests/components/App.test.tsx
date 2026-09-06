import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/App';

describe('App root component & global forensic keyboard coordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders application layout and auto-loads procedural demo evidence', async () => {
    render(<App />);

    // Header Branding
    expect(screen.getByText('CANVAS-REDACT')).toBeInTheDocument();
    expect(screen.getByText('100% Client-Side Air-Gapped')).toBeInTheDocument();

    // Auto-loaded demo annotations
    await waitFor(() => {
      expect(screen.getAllByText('Suspect Face').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Vehicle Plate').length).toBeGreaterThan(0);
    });

    // Verify timecode HUD is rendered
    expect(screen.getAllByText(/00:00:00:00/).length).toBeGreaterThan(0);
  });

  it('opens and closes export modal via action button and escape key', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('Suspect Face').length).toBeGreaterThan(0);
    });

    const exportBtn = screen.getByRole('button', { name: /Export evidence JSON/i });
    await waitFor(() => expect(exportBtn).toBeEnabled());
    fireEvent.click(exportBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Evidence Review Manifest/i)).toBeInTheDocument();

    // Close via Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('toggles forensic shortcuts guide via ? key', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('Suspect Face').length).toBeGreaterThan(0);
    });

    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText(/Forensic Keyboard Shortcuts/i)).toBeInTheDocument();

    // Close via Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText(/Forensic Keyboard Shortcuts/i)).not.toBeInTheDocument();
  });

  it('bypasses global keyboard shortcuts when user is focused inside a text input', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('Suspect Face').length).toBeGreaterThan(0);
    });

    // Select Suspect Face box to open inspector
    const suspectElements = screen.getAllByText('Suspect Face');
    expect(suspectElements.length).toBeGreaterThan(0);
    fireEvent.click(suspectElements[0]!);

    const labelInput = screen.getByLabelText(/Annotation Label/i);
    labelInput.focus();

    // Press Space inside input
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    labelInput.dispatchEvent(spaceEvent);

    // Playback state should remain unchanged (not toggled)
    expect(screen.getAllByText(/00:00:00:00/).length).toBeGreaterThan(0);
  });
});
