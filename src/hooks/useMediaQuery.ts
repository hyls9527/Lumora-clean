import { useState, useEffect } from 'react';

/**
 * 响应式媒体查询 Hook
 * 使用 window.matchMedia API 监听窗口尺寸变化
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    
    // 初始值
    setMatches(mediaQuery.matches);

    // 监听变化
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // 添加监听器
    mediaQuery.addEventListener('change', handler);

    // 清理
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 640px)');
}
