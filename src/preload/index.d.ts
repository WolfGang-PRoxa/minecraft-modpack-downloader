import type { StudioApi } from '../shared/studio'
import type { RendererApi } from '../shared/types'

declare global {
  interface Window {
    api: RendererApi
    /** Présent uniquement dans la fenêtre du studio. */
    studio: StudioApi
  }
}
