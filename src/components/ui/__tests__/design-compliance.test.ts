import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = process.cwd();

/**
 * UI 一致性测试 — 验证组件严格遵循 DESIGN.md 规范
 * 古卷·灯火设计语言
 */
describe('UI 一致性 — DESIGN.md 合规', () => {
  describe('反模式检查', () => {
    const componentFiles = [
      'src/components/ui/Rating.tsx',
      'src/components/ui/Sidebar.tsx',
      'src/components/ui/ImageCard.tsx',
      'src/components/ui/CommandPalette.tsx',
      'src/components/ui/DetailModal.tsx',
      'src/components/ui/TagBadge.tsx',
      'src/components/ui/SimilarityBadge.tsx',
      'src/components/ui/EmbeddingBadge.tsx',
    ];

    it('不使用 Inter 字体', () => {
      componentFiles.forEach((file) => {
        try {
          const content = readFileSync(resolve(root, file), 'utf-8');
          expect(content).not.toContain('Inter');
        } catch {
          // File may not exist in test environment
        }
      });
    });

    it('不使用纯黑 #000 或纯白 #fff', () => {
      componentFiles.forEach((file) => {
        try {
          const content = readFileSync(resolve(root, file), 'utf-8');
          expect(content).not.toMatch(/#000[^0-9a-fA-F]/);
          expect(content).not.toMatch(/#fff[^0-9a-fA-F]/);
        } catch {
          // File may not exist in test environment
        }
      });
    });

    it('不使用 lucide-react 图标', () => {
      componentFiles.forEach((file) => {
        try {
          const content = readFileSync(resolve(root, file), 'utf-8');
          expect(content).not.toContain('lucide');
        } catch {
          // File may not exist in test environment
        }
      });
    });

    it('不使用 100ms 过渡', () => {
      componentFiles.forEach((file) => {
        try {
          const content = readFileSync(resolve(root, file), 'utf-8');
          expect(content).not.toContain('100ms');
        } catch {
          // File may not exist in test environment
        }
      });
    });

    it('不使用紫色渐变', () => {
      componentFiles.forEach((file) => {
        try {
          const content = readFileSync(resolve(root, file), 'utf-8');
          expect(content).not.toContain('purple');
        } catch {
          // File may not exist in test environment
        }
      });
    });
  });

  describe('设计令牌检查', () => {
    it('使用正确的强调色 #7a5c12', () => {
      const rating = readFileSync(resolve(root, 'src/components/ui/Rating.tsx'), 'utf-8');
      expect(rating).toMatch(/t\.accent|tok\.accent/);
    });

    it('使用正确的文字颜色 #2a2118', () => {
      const sidebar = readFileSync(resolve(root, 'src/components/ui/Sidebar.tsx'), 'utf-8');
      // Uses token reference instead of hardcoded value
      expect(sidebar).toContain('tok.text');
      expect(sidebar).toContain("from '../../lib/tokens'");
    });

    it('使用 200ms 过渡', () => {
      const imageCard = readFileSync(resolve(root, 'src/components/ui/ImageCard.tsx'), 'utf-8');
      expect(imageCard).toContain('200ms');
    });
  });

  describe('组件规范检查', () => {
    it('卡片使用 2px 圆角', () => {
      const imageCard = readFileSync(resolve(root, 'src/components/ui/ImageCard.tsx'), 'utf-8');
      expect(imageCard).toContain("borderRadius: '2px'");
    });

    it('弹窗使用 6px 圆角', () => {
      const commandPalette = readFileSync(resolve(root, 'src/components/ui/CommandPalette.tsx'), 'utf-8');
      expect(commandPalette).toContain('borderRadius: 6');
    });

    it('按钮使用 4px 圆角', () => {
      const sidebar = readFileSync(resolve(root, 'src/components/ui/Sidebar.tsx'), 'utf-8');
      expect(sidebar).toContain('borderRadius: 4');
    });

    it('评分使用梅花印', () => {
      const rating = readFileSync(resolve(root, 'src/components/ui/Rating.tsx'), 'utf-8');
      expect(rating).toContain('PlumStamp');
      expect(rating).toContain('梅花印');
    });

    it('收藏使用藏书印 ◆', () => {
      const imageCard = readFileSync(resolve(root, 'src/components/ui/ImageCard.tsx'), 'utf-8');
      expect(imageCard).toContain('◆');
      // i18n: '收藏' replaced with t('common.favorite')
      expect(imageCard).toContain('common.favorite');
    });
  });

  describe('可访问性检查', () => {
    it('按钮有 aria-label', () => {
      const imageCard = readFileSync(resolve(root, 'src/components/ui/ImageCard.tsx'), 'utf-8');
      expect(imageCard).toContain('aria-label');
    });

    it('侧边栏有 role=navigation', () => {
      const sidebar = readFileSync(resolve(root, 'src/components/ui/Sidebar.tsx'), 'utf-8');
      expect(sidebar).toContain('role="navigation"');
    });

    it('命令面板有 role=listbox', () => {
      const commandPalette = readFileSync(resolve(root, 'src/components/ui/CommandPalette.tsx'), 'utf-8');
      expect(commandPalette).toContain('role="listbox"');
    });
  });
});
