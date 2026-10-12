import { useCallback, useEffect, useState } from 'react';

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

export function useFullscreen() {
  const doc = document as FsDoc;
  const [isFullscreen, setIsFullscreen] = useState<boolean>(!!(doc.fullscreenElement || doc.webkitFullscreenElement));

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [doc]);

  const enter = useCallback(async (el?: HTMLElement | null) => {
    const target = (el || document.documentElement) as FsEl;
    try {
      if (target.requestFullscreen) await target.requestFullscreen();
      else if (target.webkitRequestFullscreen) await target.webkitRequestFullscreen();
    } catch {
      /* el navegador puede rechazarlo sin gesto del usuario */
    }
  }, []);

  const exit = useCallback(async () => {
    try {
      if (doc.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
    } catch {
      /* ignorar */
    }
  }, [doc]);

  const toggle = useCallback(
    (el?: HTMLElement | null) => (doc.fullscreenElement || doc.webkitFullscreenElement ? exit() : enter(el)),
    [doc, enter, exit],
  );

  return { isFullscreen, enter, exit, toggle };
}
