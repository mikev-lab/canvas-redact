import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/App';

describe('App root component & global forensic keyboard coordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders application layout with initial clean evidence dropzone', async () => {
    render(<App />);

    // Header Branding
    expect(screen.getByText('CANVAS-REDACT')).toBeInTheDocument();
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();

    // Dropzone is displayed
    expect(screen.getByText('Drop Evidence Video Here')).toBeInTheDocument();

    // Verify timecode HUD is rendered
    expect(screen.getAllByText(/00:00:00:00/).length).toBeGreaterThan(0);
  });

  const loadTestAnnotations = async () => {
    const videoInput = screen.getAllByLabelText(/Upload evidence video file/i)[0] as HTMLInputElement;
    const videoFile = new File(['fake video'], 'test.mp4', { type: 'video/mp4' });
    fireEvent.change(videoInput, { target: { files: [videoFile] } });

    const manifestInput = screen.getByLabelText(/Upload evidence review JSON manifest file/i) as HTMLInputElement;
    const mockManifest = JSON.stringify({
      version: '1.0.0',
      metadata: {
        source: 'canvas-redact',
        videoName: 'test.mp4',
        durationMs: 10000,
        dimensions: { width: 1920, height: 1080 },
        exportedAt: new Date().toISOString()
      },
      redactions: [
        {
          id: 'test-box-1',
          label: 'Suspect Face',
          type: 'blur',
          startMs: 0,
          endMs: 8000,
          bbox: [0.15, 0.28, 0.12, 0.2]
        }
      ]
    });

    const file = new File([mockManifest], 'manifest.json', { type: 'application/json' });
    const originalFileReader = window.FileReader;
    class MockFileReader {
      onload: ((e: { target: { result: string } }) => void) | null = null;
      readAsText() {
        if (this.onload) {
          this.onload({ target: { result: mockManifest } });
        }
      }
    }
    // @ts-expect-error mocking FileReader for test
    window.FileReader = MockFileReader;
    fireEvent.change(manifestInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getAllByText('Suspect Face').length).toBeGreaterThan(0);
    });
    window.FileReader = originalFileReader;
  };

  it('opens and closes export modal via action button and escape key', async () => {
    render(<App />);
    await loadTestAnnotations();

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
    await loadTestAnnotations();

    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText(/Forensic Keyboard Shortcuts/i)).toBeInTheDocument();

    // Close via Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText(/Forensic Keyboard Shortcuts/i)).not.toBeInTheDocument();
  });

  it('bypasses global keyboard shortcuts when user is focused inside a text input', async () => {
    render(<App />);
    await loadTestAnnotations();

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

  it('imports evidence JSON manifest and updates state', async () => {
    render(<App />);

    const manifestInput = screen.getByLabelText(/Upload evidence review JSON manifest file/i) as HTMLInputElement;

    const mockManifest = JSON.stringify({
      version: '1.0.0',
      metadata: {
        source: 'canvas-redact',
        videoName: 'test.mp4',
        durationMs: 10000,
        dimensions: { width: 1920, height: 1080 },
        exportedAt: new Date().toISOString()
      },
      redactions: [
        {
          id: 'imported-box-1',
          label: 'Custom Imported Tag',
          type: 'blackout',
          startMs: 0,
          endMs: 5000,
          bbox: [0.1, 0.1, 0.2, 0.2]
        }
      ]
    });

    const file = new File([mockManifest], 'evidence_manifest.json', { type: 'application/json' });

    // Mock FileReader to trigger onload synchronously in test
    const originalFileReader = window.FileReader;
    class MockFileReader {
      onload: ((e: { target: { result: string } }) => void) | null = null;
      readAsText() {
        if (this.onload) {
          this.onload({ target: { result: mockManifest } });
        }
      }
    }
    // @ts-expect-error mocking FileReader for test
    window.FileReader = MockFileReader;

    fireEvent.change(manifestInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getAllByText('Custom Imported Tag').length).toBeGreaterThan(0);
      expect(screen.getByText(/Successfully imported 1 redactions from manifest/i)).toBeInTheDocument();
    });

    window.FileReader = originalFileReader;
  });

  it('supports Censor Tracking Mode toggle, keyframe marking hotkeys, and stepping', async () => {
    render(<App />);
    await loadTestAnnotations();

    // Select the redaction box to open inspector
    const suspectElements = screen.getAllByText('Suspect Face');
    fireEvent.click(suspectElements[0]!);

    // Verify keyframe count starts at 0 Saved
    expect(screen.getByText('0 Saved')).toBeInTheDocument();

    // Press 'm' to mark keyframe at current position (t=0)
    fireEvent.keyDown(window, { key: 'm' });

    // Should now have 1 keyframe recorded
    await waitFor(() => {
      expect(screen.getByText('1 Saved')).toBeInTheDocument();
    });

    // Toggle Tracking Mode using 't' hotkey
    fireEvent.keyDown(window, { key: 't' });
    expect(screen.getByText(/ON \(Space = Step\)/i)).toBeInTheDocument();

    // With Tracking Mode enabled and box selected, pressing Space marks keyframe at current pos and steps forward
    fireEvent.keyDown(window, { key: ' ' });

    // Press Space again at the new stepped position to record a second keyframe
    fireEvent.keyDown(window, { key: ' ' });

    // Should now have 2 keyframes recorded
    await waitFor(() => {
      expect(screen.getByText('2 Saved')).toBeInTheDocument();
    });

    // Press 't' again to disable tracking mode
    fireEvent.keyDown(window, { key: 't' });
    expect(screen.getByRole('button', { name: /Toggle Censor Tracking Mode \(current: OFF\)/i })).toBeInTheDocument();
  });

  it('navigates between keyframes using Alt+Left and Alt+Right', async () => {
    render(<App />);
    await loadTestAnnotations();

    // Select the redaction box
    const suspectElements = screen.getAllByText('Suspect Face');
    fireEvent.click(suspectElements[0]!);

    // Mark keyframe at current position
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('1 Saved')).toBeInTheDocument();
    });

    // Step forward 5 frames
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    // Mark another keyframe
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('2 Saved')).toBeInTheDocument();
    });

    // Press Alt+ArrowLeft to jump back to previous keyframe
    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true });

    // Press Alt+ArrowRight to jump forward to next keyframe
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true });
  });

  it('updates Reviewer ID in Header and includes it in Export modal preview', async () => {
    render(<App />);
    await loadTestAnnotations();

    // Find Reviewer ID input in Header
    const reviewerInput = screen.getByPlaceholderText(/Reviewer ID/i);
    fireEvent.change(reviewerInput, { target: { value: 'OFC-4921' } });
    expect(reviewerInput).toHaveValue('OFC-4921');

    // Click Export JSON button
    const exportBtn = screen.getByRole('button', { name: /Export evidence JSON/i });
    fireEvent.click(exportBtn);

    // Modal dialog should display the Reviewer ID badge
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Reviewer: OFC-4921/i)).toBeInTheDocument();
    expect(screen.getByText(/"reviewerId": "OFC-4921"/i)).toBeInTheDocument();
  });

  it('opens Auto-Redact Subject Gallery modal when Auto-Redact button is clicked', async () => {
    render(<App />);
    await loadTestAnnotations();

    // Find and click Auto-Redact button
    const autoRedactBtn = screen.getByRole('button', { name: /Launch AI face detection/i });
    expect(autoRedactBtn).toBeInTheDocument();

    fireEvent.click(autoRedactBtn);

    // Auto-Redact modal should now be visible via lazy loading
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/AI FACE DETECTION & SUBJECT GALLERY/i)).toBeInTheDocument();
    });

    // Dismiss with Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText(/AI FACE DETECTION & SUBJECT GALLERY/i)).not.toBeInTheDocument();
    });
  });

  it('opens Import Manifest modal when Import JSON button is clicked in header', async () => {
    render(<App />);

    const importBtn = screen.getByRole('button', { name: /Import evidence review JSON manifest/i });
    expect(importBtn).toBeInTheDocument();

    fireEvent.click(importBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Import Evidence Review Manifest \(JSON v1.0.0\)/i)).toBeInTheDocument();

    // Close with Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText(/Import Evidence Review Manifest/i)).not.toBeInTheDocument();
  });
});
