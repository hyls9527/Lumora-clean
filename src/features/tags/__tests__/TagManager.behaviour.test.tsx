import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TagManager } from '../TagManager';

const h = vi.hoisted(() => ({
  t: vi.fn((key: string, opts?: Record<string, unknown>) =>
    opts ? `${key}(${JSON.stringify(opts)})` : key,
  ),
  listTags: vi.fn(),
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  updateTag: vi.fn(),
  isMobile: { value: false },
}));

vi.mock('../../../lib/api/images', () => ({
  listTags: h.listTags,
  createTag: h.createTag,
  deleteTag: h.deleteTag,
  updateTag: h.updateTag,
}));

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: h.t }),
  t: h.t,
}));

vi.mock('../../../hooks/useMediaQuery', () => ({
  useIsMobile: () => h.isMobile.value,
}));

interface TagRow {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
}

function tag(id: string, name: string, color: string | null = null): TagRow {
  return { id, name, color, createdAt: '2025-01-01' };
}

function tagRow(name: string): HTMLElement {
  return screen.getByText(name).closest('div') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.isMobile.value = false;
  h.listTags.mockResolvedValue([]);
  h.createTag.mockResolvedValue(undefined);
  h.deleteTag.mockResolvedValue(undefined);
  h.updateTag.mockResolvedValue(undefined);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TagManager loading', () => {
  it('loads and renders every tag from the backend', async () => {
    h.listTags.mockResolvedValue([tag('t1', 'forest', '#e8d5b7'), tag('t2', 'portrait')]);

    render(<TagManager />);

    await waitFor(() => expect(screen.getByText('forest')).toBeTruthy());
    expect(screen.getByText('portrait')).toBeTruthy();
    // A tag without a colour falls back to the neutral swatch.
    const swatch = tagRow('portrait').querySelector('div') as HTMLElement;
    expect(swatch.style.background).toBe('rgba(139, 115, 75, 0.15)');
    expect((tagRow('forest').querySelector('div') as HTMLElement).style.background).toBe('rgb(232, 213, 183)');
  });

  it('shows the empty state when the library has no tags', async () => {
    render(<TagManager />);

    await waitFor(() => expect(screen.getByText('tags.empty')).toBeTruthy());
  });

  it('surfaces a load failure instead of an empty list', async () => {
    h.listTags.mockRejectedValue(new Error('数据库被锁定'));

    render(<TagManager />);

    await waitFor(() => expect(screen.getByText('数据库被锁定')).toBeTruthy());
  });

  it('falls back to a generic message for a non-Error rejection', async () => {
    h.listTags.mockRejectedValue('boom');

    render(<TagManager />);

    await waitFor(() => expect(screen.getByText('加载标签失败')).toBeTruthy());
  });
});

describe('TagManager create', () => {
  it('keeps the create button disabled until a name is typed', () => {
    render(<TagManager />);

    const button = screen.getByRole('button', { name: '创建标签' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('tags.inputPlaceholder'), {
      target: { value: '   ' },
    });
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('tags.inputPlaceholder'), {
      target: { value: 'forest' },
    });
    expect(button.disabled).toBe(false);
  });

  it('creates the tag with the picked colour and clears the form', async () => {
    render(<TagManager />);
    const input = screen.getByPlaceholderText('tags.inputPlaceholder') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '  forest  ' } });
    fireEvent.click(screen.getByLabelText('选择颜色 #c9b896'));
    h.listTags.mockResolvedValue([tag('t1', 'forest', '#c9b896')]);
    fireEvent.click(screen.getByRole('button', { name: '创建标签' }));

    await waitFor(() => expect(h.createTag).toHaveBeenCalledWith('forest', '#c9b896'));
    await waitFor(() => expect(input.value).toBe(''));
    expect(h.listTags).toHaveBeenCalledTimes(2);
    expect(screen.getByText('forest')).toBeTruthy();
  });

  it('deselects a colour when it is clicked twice', async () => {
    render(<TagManager />);

    fireEvent.change(screen.getByPlaceholderText('tags.inputPlaceholder'), {
      target: { value: 'forest' },
    });
    fireEvent.click(screen.getByLabelText('选择颜色 #c9b896'));
    fireEvent.click(screen.getByLabelText('选择颜色 #c9b896'));
    fireEvent.click(screen.getByRole('button', { name: '创建标签' }));

    await waitFor(() => expect(h.createTag).toHaveBeenCalledWith('forest', null));
  });

  it('creates on Enter in the name field', async () => {
    render(<TagManager />);
    const input = screen.getByPlaceholderText('tags.inputPlaceholder');

    fireEvent.change(input, { target: { value: 'forest' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(h.createTag).toHaveBeenCalledWith('forest', null));
  });

  it('ignores other keys', () => {
    render(<TagManager />);
    const input = screen.getByPlaceholderText('tags.inputPlaceholder');

    fireEvent.change(input, { target: { value: 'forest' } });
    fireEvent.keyDown(input, { key: 'a' });

    expect(h.createTag).not.toHaveBeenCalled();
  });

  it('does nothing for a whitespace-only name', () => {
    render(<TagManager />);
    const input = screen.getByPlaceholderText('tags.inputPlaceholder');

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(h.createTag).not.toHaveBeenCalled();
  });

  it('reports a create failure and keeps the typed name', async () => {
    h.createTag.mockRejectedValue(new Error('标签已存在'));
    render(<TagManager />);
    const input = screen.getByPlaceholderText('tags.inputPlaceholder') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'forest' } });
    fireEvent.click(screen.getByRole('button', { name: '创建标签' }));

    await waitFor(() => expect(screen.getByText('标签已存在')).toBeTruthy());
    expect(input.value).toBe('forest');
  });
});

describe('TagManager delete', () => {
  it('asks for confirmation before deleting and reloads after success', async () => {
    h.listTags.mockResolvedValue([tag('t1', 'forest')]);
    render(<TagManager />);
    await waitFor(() => expect(screen.getByText('forest')).toBeTruthy());

    h.listTags.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    expect(window.confirm).toHaveBeenCalledWith('tags.confirmDelete({"name":"forest"})');
    await waitFor(() => expect(h.deleteTag).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(screen.getByText('tags.empty')).toBeTruthy());
  });

  it('deletes nothing when the confirmation is declined', async () => {
    (window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    h.listTags.mockResolvedValue([tag('t1', 'forest')]);
    render(<TagManager />);
    await waitFor(() => expect(screen.getByText('forest')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    expect(h.deleteTag).not.toHaveBeenCalled();
    expect(h.listTags).toHaveBeenCalledTimes(1);
  });

  it('reports a delete failure', async () => {
    h.deleteTag.mockRejectedValue(new Error('标签仍被使用'));
    h.listTags.mockResolvedValue([tag('t1', 'forest')]);
    render(<TagManager />);
    await waitFor(() => expect(screen.getByText('forest')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => expect(screen.getByText('标签仍被使用')).toBeTruthy());
  });
});

describe('TagManager colour editing', () => {
  it('shows the palette for the tag being edited only', async () => {
    h.listTags.mockResolvedValue([tag('t1', 'forest'), tag('t2', 'portrait')]);
    render(<TagManager />);
    await waitFor(() => expect(screen.getByText('forest')).toBeTruthy());

    fireEvent.click(screen.getAllByRole('button', { name: '编辑颜色' })[0]);

    // 10 preset colours + cancel, plus the row's own delete button.
    expect(tagRow('forest').querySelectorAll('button')).toHaveLength(12);
    expect(screen.getAllByRole('button', { name: '编辑颜色' })).toHaveLength(1);
  });

  it('saves the new colour and closes the editor', async () => {
    h.listTags.mockResolvedValue([tag('t1', 'forest')]);
    render(<TagManager />);
    await waitFor(() => expect(screen.getByText('forest')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: '编辑颜色' }));
    fireEvent.click(tagRow('forest').querySelectorAll('button')[0]);

    await waitFor(() => expect(h.updateTag).toHaveBeenCalledWith('t1', { color: '#e8d5b7' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '编辑颜色' })).toBeTruthy());
    expect(h.listTags).toHaveBeenCalledTimes(2);
  });

  it('cancels the editor without saving', async () => {
    h.listTags.mockResolvedValue([tag('t1', 'forest')]);
    render(<TagManager />);
    await waitFor(() => expect(screen.getByText('forest')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: '编辑颜色' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

    expect(h.updateTag).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '编辑颜色' })).toBeTruthy();
  });

  it('still closes the editor when the colour update fails, and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.updateTag.mockRejectedValue(new Error('db locked'));
    h.listTags.mockResolvedValue([tag('t1', 'forest')]);
    render(<TagManager />);
    await waitFor(() => expect(screen.getByText('forest')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: '编辑颜色' }));
    fireEvent.click(tagRow('forest').querySelectorAll('button')[0]);

    await waitFor(() => expect(warn).toHaveBeenCalledWith('Failed to update tag color:', expect.any(Error)));
    expect(screen.getByRole('button', { name: '编辑颜色' })).toBeTruthy();
  });
});

describe('TagManager layout and affordances', () => {
  it('uses the desktop shell by default', () => {
    render(<TagManager />);

    expect(screen.getByText('标签管理').className).toBe('page-title');
    expect((screen.getByPlaceholderText('tags.inputPlaceholder') as HTMLElement).style.maxWidth).toBe('240px');
  });

  it('switches to the mobile shell on small screens', () => {
    h.isMobile.value = true;
    render(<TagManager />);

    expect(screen.getByText('标签管理').className).toBe('page-title page-title--mobile');
    const input = screen.getByPlaceholderText('tags.inputPlaceholder') as HTMLElement;
    expect(input.style.maxWidth).toBe('100%');
    expect(input.style.fontSize).toBe('14px');
  });

  it('highlights the row under the pointer', async () => {
    h.listTags.mockResolvedValue([tag('t1', 'forest')]);
    render(<TagManager />);
    await waitFor(() => expect(screen.getByText('forest')).toBeTruthy());
    const row = tagRow('forest');

    fireEvent.mouseEnter(row);
    expect(row.style.borderColor).toBe('rgba(139, 115, 75, 0.2)');

    fireEvent.mouseLeave(row);
    expect(row.style.borderColor).toBe('rgba(139, 115, 75, 0.08)');
  });
});
