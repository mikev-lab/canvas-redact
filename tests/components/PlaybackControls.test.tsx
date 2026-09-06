import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlaybackControls } from '../../src/components/PlaybackControls';

describe('PlaybackControls component', () => {
  const defaultProps = {
    isPlaying: false,
    currentTimeMs: 1500,
    durationMs: 10000,
    playbackRate: 1,
    shuttleRate: 0,
    fps: 30,
    volume: 0.8,
    isMuted: false,
    isReady: true,
    onTogglePlay: vi.fn(),
    onStepFrame: vi.fn(),
    onSetRate: vi.fn(),
    onShuttleReverse: vi.fn(),
    onShuttlePause: vi.fn(),
    onShuttleForward: vi.fn(),
    onSetVolume: vi.fn(),
    onToggleMute: vi.fn()
  };

  it('renders timecode HUD and frame information', () => {
    render(<PlaybackControls {...defaultProps} />);

    // 1500ms at 30fps is 00:00:01:15
    expect(screen.getByText('00:00:01:15')).toBeInTheDocument();
    expect(screen.getByText('00:00:10:00')).toBeInTheDocument();
    expect(screen.getByText(/FR: 0045/i)).toBeInTheDocument();
  });

  it('toggles play/pause when main action button is clicked', () => {
    const onTogglePlay = vi.fn();
    const { rerender } = render(<PlaybackControls {...defaultProps} onTogglePlay={onTogglePlay} />);

    const playBtn = screen.getByRole('button', { name: /Play video/i });
    fireEvent.click(playBtn);
    expect(onTogglePlay).toHaveBeenCalled();

    // Rerender as playing
    rerender(<PlaybackControls {...defaultProps} isPlaying={true} onTogglePlay={onTogglePlay} />);
    const pauseBtn = screen.getByRole('button', { name: /Pause video/i });
    expect(pauseBtn).toBeInTheDocument();
  });

  it('steps frame backward and forward', () => {
    const onStepFrame = vi.fn();
    render(<PlaybackControls {...defaultProps} onStepFrame={onStepFrame} />);

    const stepForwardBtn = screen.getByRole('button', { name: /Step forward 1 frame/i });
    fireEvent.click(stepForwardBtn);
    expect(onStepFrame).toHaveBeenCalledWith('forward', 1);

    const stepBackwardBtn = screen.getByRole('button', { name: /Step backward 1 frame/i });
    fireEvent.click(stepBackwardBtn);
    expect(onStepFrame).toHaveBeenCalledWith('backward', 1);
  });

  it('jumps customizable frame count backward and forward with shift shortcuts', () => {
    const onStepFrame = vi.fn();
    render(<PlaybackControls {...defaultProps} jumpFrames={30} onStepFrame={onStepFrame} />);

    const jumpForwardBtn = screen.getByRole('button', { name: /Jump 30 frames forward/i });
    fireEvent.click(jumpForwardBtn);
    expect(onStepFrame).toHaveBeenCalledWith('forward', 30);

    const jumpBackwardBtn = screen.getByRole('button', { name: /Jump 30 frames backward/i });
    fireEvent.click(jumpBackwardBtn);
    expect(onStepFrame).toHaveBeenCalledWith('backward', 30);
  });

  it('triggers onSetJumpFrames callback when jump button is selected', () => {
    const onSetJumpFrames = vi.fn();
    render(<PlaybackControls {...defaultProps} jumpFrames={5} onSetJumpFrames={onSetJumpFrames} />);

    const btn10 = screen.getByRole('button', { name: /Set frame jump distance to 10 frames/i });
    fireEvent.click(btn10);
    expect(onSetJumpFrames).toHaveBeenCalledWith(10);
  });

  it('triggers J/K/L forensic shuttle actions', () => {
    const onShuttleForward = vi.fn();
    const onShuttleReverse = vi.fn();
    const onShuttlePause = vi.fn();

    render(
      <PlaybackControls
        {...defaultProps}
        onShuttleForward={onShuttleForward}
        onShuttleReverse={onShuttleReverse}
        onShuttlePause={onShuttlePause}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Forward shuttle/i }));
    expect(onShuttleForward).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Reverse shuttle/i }));
    expect(onShuttleReverse).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Pause shuttle/i }));
    expect(onShuttlePause).toHaveBeenCalled();
  });

  it('adjusts volume, mute status, and playback rate', () => {
    const onSetVolume = vi.fn();
    const onToggleMute = vi.fn();
    const onSetRate = vi.fn();

    render(
      <PlaybackControls
        {...defaultProps}
        onSetVolume={onSetVolume}
        onToggleMute={onToggleMute}
        onSetRate={onSetRate}
      />
    );

    // Mute toggle
    fireEvent.click(screen.getByRole('button', { name: /Mute audio/i }));
    expect(onToggleMute).toHaveBeenCalled();

    // Volume range slider
    const volumeSlider = screen.getByRole('slider', { name: /Volume level/i });
    fireEvent.change(volumeSlider, { target: { value: '0.4' } });
    expect(onSetVolume).toHaveBeenCalledWith(0.4);

    // Rate dropdown selector
    const rateSelect = screen.getByRole('combobox', { name: /Select playback speed/i });
    fireEvent.change(rateSelect, { target: { value: '2' } });
    expect(onSetRate).toHaveBeenCalledWith(2);
  });
});
