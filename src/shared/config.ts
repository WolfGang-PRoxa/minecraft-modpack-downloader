// Dépôt GitHub qui héberge à la fois l'application et les releases de modpacks.
export const GITHUB_OWNER = 'WolfGang-PRoxa'
export const GITHUB_REPO = 'minecraft-modpack-downloader'
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`

// Conventions de tags :
//  - modpack : pack-<id>-v<version>  (ex. pack-create-plus-v1.2.0)
//  - application : app-v<version>     (ex. app-v1.0.0)
export const MODPACK_TAG_PREFIX = 'pack-'
export const APP_TAG_PREFIX = 'app-v'

// Asset décrivant un modpack dans chaque release (généré par `npm run publish:modpack`).
export const MODPACK_MANIFEST_ASSET = 'modpack.json'

// Fichier déposé dans chaque instance installée par l'application.
export const INSTANCE_MARKER_FILE = '.modpack-downloader.json'

// Fichier de métadonnées d'une instance CurseForge.
export const CURSEFORGE_INSTANCE_FILE = 'minecraftinstance.json'

// Identifiant de l'app CurseForge dans Overwolf.
export const CURSEFORGE_OVERWOLF_UID = 'cchhcaiapeikjbdbpfplgmpobbcdkdaphclbmkbj'

export const CURSEFORGE_DOWNLOAD_URL = 'https://www.curseforge.com/download/app'
