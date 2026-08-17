import { Point2D, ViewportLimits, ViewportState } from "./RenderTypes";

export const DEFAULT_VIEWPORT_LIMITS: ViewportLimits = {
  minZoom: 0.1,
  maxZoom: 10.0,
};

/**
 * Viewport
 * Manages 2D viewport state and coordinate transformations between World space and Screen space.
 *
 * Mathematical Transformation:
 *   Screen = World * zoom + pan
 *   World = (Screen - pan) / zoom
 */
export class Viewport implements ViewportState {
  private _panX: number;
  private _panY: number;
  private _zoom: number;
  public readonly limits: ViewportLimits;

  constructor(
    initialState: Partial<ViewportState> = {},
    limits: ViewportLimits = DEFAULT_VIEWPORT_LIMITS
  ) {
    this.limits = { ...limits };
    Viewport.validateLimits(this.limits);

    this._panX = Number.isFinite(initialState.panX) ? (initialState.panX as number) : 0;
    this._panY = Number.isFinite(initialState.panY) ? (initialState.panY as number) : 0;

    const initialZoom = Number.isFinite(initialState.zoom) ? (initialState.zoom as number) : 1.0;
    this._zoom = this.clampZoom(initialZoom);
  }

  public static validateLimits(limits: ViewportLimits): void {
    if (!Number.isFinite(limits.minZoom) || limits.minZoom <= 0) {
      throw new Error(`Invalid minZoom: ${limits.minZoom}. Must be positive finite number.`);
    }
    if (!Number.isFinite(limits.maxZoom) || limits.maxZoom <= limits.minZoom) {
      throw new Error(
        `Invalid maxZoom: ${limits.maxZoom}. Must be greater than minZoom (${limits.minZoom}).`
      );
    }
  }

  public get panX(): number {
    return this._panX;
  }

  public get panY(): number {
    return this._panY;
  }

  public get zoom(): number {
    return this._zoom;
  }

  public getState(): ViewportState {
    return {
      panX: this._panX,
      panY: this._panY,
      zoom: this._zoom,
    };
  }

  /**
   * Clamp zoom value within [minZoom, maxZoom]
   */
  private clampZoom(zoom: number): number {
    if (!Number.isFinite(zoom) || zoom <= 0) {
      throw new Error(`Invalid zoom value: ${zoom}. Zoom must be a positive finite number.`);
    }
    return Math.max(this.limits.minZoom, Math.min(this.limits.maxZoom, zoom));
  }

  /**
   * Set absolute pan coordinates
   */
  public setPan(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`Invalid pan values: (${x}, ${y})`);
    }
    this._panX = x;
    this._panY = y;
  }

  /**
   * Translate pan by relative delta (in screen pixels)
   */
  public panBy(deltaScreenX: number, deltaScreenY: number): void {
    if (!Number.isFinite(deltaScreenX) || !Number.isFinite(deltaScreenY)) {
      throw new Error(`Invalid pan delta: (${deltaScreenX}, ${deltaScreenY})`);
    }
    this._panX += deltaScreenX;
    this._panY += deltaScreenY;
  }

  /**
   * Set absolute zoom level (centered at current origin)
   */
  public setZoom(newZoom: number): void {
    this._zoom = this.clampZoom(newZoom);
  }

  /**
   * Transform a point from World space to Screen space
   * Screen = World * zoom + pan
   */
  public worldToScreen(worldPoint: Point2D): Point2D {
    if (!Number.isFinite(worldPoint.x) || !Number.isFinite(worldPoint.y)) {
      throw new Error(`Invalid world point: (${worldPoint.x}, ${worldPoint.y})`);
    }
    return {
      x: worldPoint.x * this._zoom + this._panX,
      y: worldPoint.y * this._zoom + this._panY,
    };
  }

  /**
   * Transform a point from Screen space to World space
   * World = (Screen - pan) / zoom
   */
  public screenToWorld(screenPoint: Point2D): Point2D {
    if (!Number.isFinite(screenPoint.x) || !Number.isFinite(screenPoint.y)) {
      throw new Error(`Invalid screen point: (${screenPoint.x}, ${screenPoint.y})`);
    }
    return {
      x: (screenPoint.x - this._panX) / this._zoom,
      y: (screenPoint.y - this._panY) / this._zoom,
    };
  }

  /**
   * Zoom around a fixed screen anchor (e.g. cursor position).
   *
   * Mathematical Invariant:
   *   worldPointBefore = (screenAnchor - oldPan) / oldZoom
   *   screenAnchor = worldPointBefore * newZoom + newPan
   *   => newPan = screenAnchor - worldPointBefore * newZoom
   *
   * @param factor Zoom multiplier (e.g. 1.1 for zoom in, 0.9 for zoom out)
   * @param screenAnchor The fixed screen coordinate to anchor the zoom on
   */
  public zoomAroundAnchor(factor: number, screenAnchor: Point2D): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new Error(`Invalid zoom factor: ${factor}. Must be positive finite number.`);
    }
    if (!Number.isFinite(screenAnchor.x) || !Number.isFinite(screenAnchor.y)) {
      throw new Error(`Invalid screen anchor: (${screenAnchor.x}, ${screenAnchor.y})`);
    }

    const oldZoom = this._zoom;
    const targetZoom = oldZoom * factor;
    const newZoom = this.clampZoom(targetZoom);

    if (newZoom === oldZoom) {
      return; // At zoom limit, no change needed
    }

    // World coordinate under the screen anchor before zoom
    const worldAnchorX = (screenAnchor.x - this._panX) / oldZoom;
    const worldAnchorY = (screenAnchor.y - this._panY) / oldZoom;

    // Adjust pan so the same world point stays precisely at the screen anchor
    this._panX = screenAnchor.x - worldAnchorX * newZoom;
    this._panY = screenAnchor.y - worldAnchorY * newZoom;
    this._zoom = newZoom;
  }

  /**
   * Center the viewport around a given world point with optional zoom level
   */
  public centerOnWorldPoint(worldPoint: Point2D, screenSize: Point2D, zoom?: number): void {
    if (zoom !== undefined) {
      this._zoom = this.clampZoom(zoom);
    }
    this._panX = screenSize.x / 2 - worldPoint.x * this._zoom;
    this._panY = screenSize.y / 2 - worldPoint.y * this._zoom;
  }
}
