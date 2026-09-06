/**
 * Integration and component tests for AutoRedactModal (Subject Gallery).
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AutoRedactModal, AutoRedactModalProps } from '../../src/components/AutoRedactModal';
import { TrackedSubject } from '../../src/ai/types';

describe('AutoRedactModal Component', () => {
  const mockSubjects: TrackedSubject[] = [
    {
      id: 'subject-1',
      label: 'Subject 1',
      thumbnailUrl: 'data:image/svg+xml;utf8,<svg></svg>',
      startMs: 1200,
      endMs: 5400,
      trajectory: [
        { timeMs: 1200, bbox: [0.2, 0.2, 0.15, 0.15] },
        { timeMs: 3300, bbox: [0.25, 0.22, 0.15, 0.15] },
        { timeMs: 5400, bbox: [0.3, 0.25, 0.15, 0.15] },
      ],
      selected: false,
      type: 'blur',
      confidence: 0.94,
    },
    {
      id: 'subject-2',
      label: 'Subject 2',
      thumbnailUrl: 'data:image/svg+xml;utf8,<svg></svg>',
      startMs: 2000,
      endMs: 8000,
      trajectory: [
        { timeMs: 2000, bbox: [0.6, 0.4, 0.12, 0.12] },
        { timeMs: 8000, bbox: [0.65, 0.42, 0.12, 0.12] },
      ],
      selected: true,
      type: 'pixelate',
      confidence: 0.88,
    },
  ];

  const defaultProps: AutoRedactModalProps = {
    isOpen: true,
    onClose: vi.fn(),
    status: 'reviewing',
    progressPercent: 100,
    currentScanMs: 10000,
    durationMs: 10000,
    fps: 30,
    detectedSubjects: mockSubjects,
    selectedCount: 1,
    markAiAssisted: true,
    hardwareAcceleration: 'webgpu',
    reviewerId: 'OFC-4921',
    onStartScan: vi.fn(),
    onCancelScan: vi.fn(),
    onToggleSelection: vi.fn(),
    onUpdateTreatment: vi.fn(),
    onUpdateLabel: vi.fn(),
    onSelectAll: vi.fn(),
    onDeselectAll: vi.fn(),
    onSetMarkAiAssisted: vi.fn(),
    onApply: vi.fn(),
  };

  it('renders dialog with hardware acceleration badge and title', () => {
    render(<AutoRedactModal {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/AI FACE DETECTION & SUBJECT GALLERY/i)).toBeInTheDocument();
    expect(screen.getByText(/Apple Neural Engine \/ WebGPU Active/i)).toBeInTheDocument();
  });

  it('renders scanning state with progress bar and timecode counter', () => {
    render(
      <AutoRedactModal
        {...defaultProps}
        status="scanning"
        progressPercent={45}
        currentScanMs={4500}
        durationMs={10000}
      />
    );

    expect(screen.getByText(/Scanning Video Frames/i)).toBeInTheDocument();
    expect(screen.getByText(/45% Complete/i)).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel Scan/i });
    fireEvent.click(cancelBtn);
    expect(defaultProps.onCancelScan).toHaveBeenCalledTimes(1);
  });

  it('renders Subject Gallery with face thumbnails, labels, and checkboxes', () => {
    render(<AutoRedactModal {...defaultProps} />);

    expect(screen.getByText(/2 INDIVIDUALS DETECTED/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Selected for Redaction/i)).toBeInTheDocument();

    // Subject 1 (unselected)
    const label1Input = screen.getByLabelText(/Label for subject-1/i);
    expect(label1Input).toHaveValue('Subject 1');

    // Subject 2 (selected)
    const label2Input = screen.getByLabelText(/Label for subject-2/i);
    expect(label2Input).toHaveValue('Subject 2');

    // Toggle checkbox for Subject 1
    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox in subject 1 card is at index 0
    fireEvent.click(checkboxes[0]!);
    expect(defaultProps.onToggleSelection).toHaveBeenCalledWith('subject-1');
  });

  it('allows switching visual redaction treatments per individual', () => {
    render(<AutoRedactModal {...defaultProps} />);

    // Click Pixelate button on Subject 1
    const pixelBtns = screen.getAllByRole('button', { name: /Pixel/i });
    fireEvent.click(pixelBtns[0]!);
    expect(defaultProps.onUpdateTreatment).toHaveBeenCalledWith('subject-1', 'pixelate');

    // Click Blackout button on Subject 1
    const blackoutBtns = screen.getAllByRole('button', { name: /Blackout/i });
    fireEvent.click(blackoutBtns[0]!);
    expect(defaultProps.onUpdateTreatment).toHaveBeenCalledWith('subject-1', 'blackout');
  });

  it('allows editing subject label inline', () => {
    render(<AutoRedactModal {...defaultProps} />);

    const labelInput = screen.getByLabelText(/Label for subject-1/i);
    fireEvent.change(labelInput, { target: { value: 'Suspect Driver' } });
    expect(defaultProps.onUpdateLabel).toHaveBeenCalledWith('subject-1', 'Suspect Driver');
  });

  it('triggers onSelectAll and onDeselectAll actions', () => {
    render(<AutoRedactModal {...defaultProps} />);

    const selectAllBtn = screen.getByRole('button', { name: /^Select All$/i });
    fireEvent.click(selectAllBtn);
    expect(defaultProps.onSelectAll).toHaveBeenCalledTimes(1);

    const deselectAllBtn = screen.getByRole('button', { name: /^Deselect All$/i });
    fireEvent.click(deselectAllBtn);
    expect(defaultProps.onDeselectAll).toHaveBeenCalledTimes(1);
  });

  it('toggles legal Mark as AI-Assisted checkbox', () => {
    render(<AutoRedactModal {...defaultProps} />);

    const aiCheckbox = screen.getByLabelText(/Mark as AI-Assisted/i);
    expect(aiCheckbox).toBeChecked();

    fireEvent.click(aiCheckbox);
    expect(defaultProps.onSetMarkAiAssisted).toHaveBeenCalledWith(false);
  });

  it('calls onApply with reviewerId when Apply Redactions button is clicked', () => {
    render(<AutoRedactModal {...defaultProps} selectedCount={1} />);

    const applyBtn = screen.getByRole('button', { name: /Apply Redactions \(1\)/i });
    expect(applyBtn).not.toBeDisabled();

    fireEvent.click(applyBtn);
    expect(defaultProps.onApply).toHaveBeenCalledWith('OFC-4921');
  });

  it('disables Apply Redactions button when zero subjects are selected', () => {
    render(<AutoRedactModal {...defaultProps} selectedCount={0} />);

    const applyBtn = screen.getByRole('button', { name: /Apply Redactions \(0\)/i });
    expect(applyBtn).toBeDisabled();
  });

  it('dismisses modal when Escape key is pressed or close button is clicked', () => {
    render(<AutoRedactModal {...defaultProps} />);

    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(2);
  });

  it('triggers onSetKeyframeDensity when density buttons are clicked in review state', () => {
    const onSetKeyframeDensity = vi.fn();
    render(
      <AutoRedactModal
        {...defaultProps}
        keyframeDensity="balanced"
        onSetKeyframeDensity={onSetKeyframeDensity}
      />
    );

    const sparseBtn = screen.getByRole('button', { name: /Sparse \(~1\/s\)/i });
    fireEvent.click(sparseBtn);
    expect(onSetKeyframeDensity).toHaveBeenCalledWith('sparse');

    const denseBtn = screen.getByRole('button', { name: /Dense \(~4\/s\)/i });
    fireEvent.click(denseBtn);
    expect(onSetKeyframeDensity).toHaveBeenCalledWith('dense');
  });

  it('allows customizing keyframe density in idle state prior to scanning', () => {
    const onSetKeyframeDensity = vi.fn();
    render(
      <AutoRedactModal
        {...defaultProps}
        status="idle"
        detectedSubjects={[]}
        onSetKeyframeDensity={onSetKeyframeDensity}
      />
    );

    const sparseBtn = screen.getByRole('button', { name: /Sparse \(~1\/s\)/i });
    fireEvent.click(sparseBtn);
    expect(onSetKeyframeDensity).toHaveBeenCalledWith('sparse');
  });
});
