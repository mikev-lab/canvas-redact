import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnnotationSidebar } from '../../src/components/AnnotationSidebar';
import { RedactionBox } from '../../src/types';

describe('AnnotationSidebar component', () => {
  const box1: RedactionBox = {
    id: 'box-1',
    label: 'Suspect Face',
    type: 'blur',
    startMs: 1000,
    endMs: 4000,
    bbox: [0.1234, 0.2345, 0.3456, 0.4567]
  };

  const box2: RedactionBox = {
    id: 'box-2',
    label: 'License Plate',
    type: 'pixelate',
    startMs: 2000,
    endMs: 6000,
    bbox: [0.5, 0.5, 0.2, 0.1]
  };

  const sampleBoxes: RedactionBox[] = [box1, box2];

  const defaultProps = {
    redactions: sampleBoxes,
    activeRedactions: [box1],
    selectedRedaction: null,
    currentTimeMs: 1500,
    fps: 30,
    onSelectRedaction: vi.fn(),
    onUpdateRedaction: vi.fn(),
    onRemoveRedaction: vi.fn(),
    onSeek: vi.fn(),
    onSetInPoint: vi.fn(),
    onSetOutPoint: vi.fn()
  };

  it('renders counter badges and empty selection placeholder', () => {
    render(<AnnotationSidebar {...defaultProps} />);

    expect(screen.getByText('1 Active / 2 Total')).toBeInTheDocument();
    expect(screen.getByText(/Select or draw a bounding box/i)).toBeInTheDocument();
  });

  it('renders selected box inspector with editable fields and treatments', () => {
    const onUpdateRedaction = vi.fn();
    const onRemoveRedaction = vi.fn();
    const onSetInPoint = vi.fn();
    const onSetOutPoint = vi.fn();

    render(
      <AnnotationSidebar
        {...defaultProps}
        selectedRedaction={box1}
        onUpdateRedaction={onUpdateRedaction}
        onRemoveRedaction={onRemoveRedaction}
        onSetInPoint={onSetInPoint}
        onSetOutPoint={onSetOutPoint}
      />
    );

    // Label input
    const labelInput = screen.getByLabelText(/Annotation Label/i);
    expect(labelInput).toHaveValue('Suspect Face');
    fireEvent.change(labelInput, { target: { value: 'Updated Suspect' } });
    expect(onUpdateRedaction).toHaveBeenCalledWith('box-1', { label: 'Updated Suspect' });

    // Treatment selector: change to pixelate
    const pixelateBtn = screen.getByRole('radio', { name: /pixelate/i });
    fireEvent.click(pixelateBtn);
    expect(onUpdateRedaction).toHaveBeenCalledWith('box-1', { type: 'pixelate' });

    // In/Out buttons
    const setInBtn = screen.getByRole('button', { name: /Set In-Point to current timestamp/i });
    fireEvent.click(setInBtn);
    expect(onSetInPoint).toHaveBeenCalledWith('box-1', 1500);

    const setOutBtn = screen.getByRole('button', { name: /Set Out-Point to current timestamp/i });
    fireEvent.click(setOutBtn);
    expect(onSetOutPoint).toHaveBeenCalledWith('box-1', 1500);

    // Coordinate geometry readout
    expect(screen.getByText('X: 0.1234')).toBeInTheDocument();
    expect(screen.getByText('Y: 0.2345')).toBeInTheDocument();
    expect(screen.getByText('W: 0.3456')).toBeInTheDocument();
    expect(screen.getByText('H: 0.4567')).toBeInTheDocument();

    // Delete button
    const deleteBtn = screen.getByRole('button', { name: /Delete this redaction annotation/i });
    fireEvent.click(deleteBtn);
    expect(onRemoveRedaction).toHaveBeenCalledWith('box-1');
  });

  it('handles item selection and jump-to-timestamp from segment list', () => {
    const onSelectRedaction = vi.fn();
    const onSeek = vi.fn();

    render(
      <AnnotationSidebar
        {...defaultProps}
        onSelectRedaction={onSelectRedaction}
        onSeek={onSeek}
      />
    );

    const plateItem = screen.getByText('License Plate');
    fireEvent.click(plateItem);

    expect(onSelectRedaction).toHaveBeenCalledWith('box-2');
    expect(onSeek).toHaveBeenCalledWith(2000);
  });
});
