import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabButton } from '../TabButton';

describe('TabButton', () => {
  it('should render children text', () => {
    render(<TabButton active={false} onClick={() => {}}>评分</TabButton>);
    expect(screen.getByText('评分')).toBeDefined();
  });

  it('should apply active styles when active', () => {
    render(<TabButton active={true} onClick={() => {}}>时间</TabButton>);
    const btn = screen.getByText('时间') as HTMLButtonElement;
    expect(btn.style.borderBottom).toMatch(/#7a5c12|rgb\(122, 92, 18\)/);
  });

  it('should apply inactive styles when not active', () => {
    render(<TabButton active={false} onClick={() => {}}>模型</TabButton>);
    const btn = screen.getByText('模型') as HTMLButtonElement;
    expect(btn.style.borderBottom).toContain('transparent');
  });

  it('should call onClick when clicked', () => {
    let clicked = false;
    render(<TabButton active={false} onClick={() => { clicked = true; }}>尺寸</TabButton>);
    fireEvent.click(screen.getByText('尺寸'));
    expect(clicked).toBe(true);
  });

  it('should use custom color when provided', () => {
    render(<TabButton active={true} onClick={() => {}} color="#8b3030">自定义</TabButton>);
    const btn = screen.getByText('自定义') as HTMLButtonElement;
    expect(btn.style.borderBottom).toMatch(/#8b3030|rgb\(139, 48, 48\)/);
  });
});
