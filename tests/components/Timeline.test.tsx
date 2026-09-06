import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Timeline } from '../../src/components/Timeline';
import { RedactionBox } from '../../src/types';

describe('Timeline component', () => {
  const sampleRedactions: RedactionBox[] = [
    {
      id: 'box-1',
      label: 'Target Alpha',
      type: 'blur',
      startMs: 1000,
      endMs: 4000,
      bbox: [0.1, 0.1, 0.2, 0.2]
    },
    {
      id: 'box-2',
      label: 'License Plate',
      type: 'pixelate',
      startMs: 3000,
      endMs: 7000,
      bbox: [0.4, 0.5, 0.2, 0.1]
    }
  ];

  const defaultProps = {
    currentTimeMs: 2500,
    durationMs: 10000,
    fps: 30,
    redactions: sampleRedactions,
    selectedId: null,
    onSeek: vi.fn(),
    onSelectRedaction: vi.fn(),
    onSetInPoint: vi.fn(),
    onSetOutPoint: vi.fn()
  };

  it('renders timeline track slider with accessible ARIA values', () => {
    render(<Timeline {...defaultProps} />);

    const slider = screen.getByRole('slider', { name: /Media playhead timeline/i });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '10000');
    expect(slider).toHaveAttribute('aria-valuenow', '2500');
  });

  it('renders visual redaction segments on multi-track view', () => {
    render(<Timeline {...defaultProps} />);

    expect(screen.getByText('Target Alpha')).toBeInTheDocument();
    expect(screen.getByText('License Plate')).toBeInTheDocument();
  });

  it('selects annotation and jumps to start time when segment is clicked', () => {
    const onSelectRedaction = vi.fn();
    const onSeek = vi.fn();

    render(
      <Timeline
        {...defaultProps}
        onSelectRedaction={onSelectRedaction}
        onSeek={onSeek}
      />
    );

    const segment = screen.getByText('Target Alpha');
    fireEvent.click(segment);

    expect(onSelectRedaction).toHaveBeenCalledWith('box-1');
    expect(onSeek).toHaveBeenCalledWith(1000);
  });

  it('renders draggable In/Out bracket handles for the selected box', () => {
    render(<Timeline {...defaultProps} selectedId="box-1" />);

    expect(screen.getByText('[')).toBeInTheDocument();
    expect(screen.getByText(']')).toBeInTheDocument();
  });

  it('supports keyboard seek navigation via arrow keys and home/end', () => {
    const onSeek = vi.fn();
    render(<Timeline {...defaultProps} onSeek={onSeek} />);

    const slider = screen.getByRole('slider', { name: /Media playhead timeline/i });

    // ArrowLeft: steps backward by 1 frame (~33ms)
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onSeek).toHaveBeenCalledWith(2467);

    // ArrowRight: steps forward by 1 frame (~33ms)
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenCalledWith(2533);

    // PageDown: steps forward by 1 second (1000ms)
    fireEvent.keyDown(slider, { key: 'PageDown' });
    expect(onSeek).toHaveBeenCalledWith(3500);

    // PageUp: steps backward by 1 second (1000ms)
    fireEvent.keyDown(slider, { key: 'PageUp' });
    expect(onSeek).toHaveBeenCalledWith(1500);

    // Home: jumps to 0
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onSeek).toHaveBeenCalledWith(0);

    // End: jumps to duration
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onSeek).toHaveBeenCalledWith(10000);
  });
});
