// Camera: world (map pixels) <-> screen (CSS pixels).
export const createCamera = () => ({ x: 0, y: 0, zoom: 1 });

export const screenToWorld = (cam, sx, sy) => ({ x: sx / cam.zoom + cam.x, y: sy / cam.zoom + cam.y });
export const worldToScreen = (cam, wx, wy) => ({ x: (wx - cam.x) * cam.zoom, y: (wy - cam.y) * cam.zoom });

export function zoomAt(cam, factor, sx, sy) {
  const before = screenToWorld(cam, sx, sy);
  cam.zoom = Math.min(3, Math.max(0.4, cam.zoom * factor));
  cam.x = before.x - sx / cam.zoom;
  cam.y = before.y - sy / cam.zoom;
}

// Center the camera on a world point.
export function centerOn(cam, wx, wy, screenW, screenH) {
  cam.x = wx - screenW / 2 / cam.zoom;
  cam.y = wy - screenH / 2 / cam.zoom;
}
