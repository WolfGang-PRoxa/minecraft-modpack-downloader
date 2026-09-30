import type { RepoRef } from './types'

// Dépôt de l'application : ses mises à jour (tags app-v*) en viennent toujours,
// et c'est la source des modpacks par défaut. Un publieur peut en choisir une autre.
export const APP_REPO: RepoRef = { owner: 'WolfGang-PRoxa', name: 'minecraft-modpack-downloader' }
export const APP_REPO_URL = `https://github.com/${APP_REPO.owner}/${APP_REPO.name}`

// Conventions de tags :
//  - modpack : pack-<id>-v<version>  (ex. pack-create-plus-v1.2.0)
//  - application : app-v<version>     (ex. app-v1.0.0)
export const MODPACK_TAG_PREFIX = 'pack-'
export const APP_TAG_PREFIX = 'app-v'

// Asset décrivant un modpack dans chaque release (généré par le Modpack Studio).
export const MODPACK_MANIFEST_ASSET = 'modpack.json'

// Fichier déposé dans chaque instance installée par l'application.
export const INSTANCE_MARKER_FILE = '.modpack-downloader.json'

// Fichier de métadonnées d'une instance CurseForge.
export const CURSEFORGE_INSTANCE_FILE = 'minecraftinstance.json'

// Identifiant de l'app CurseForge dans Overwolf.
export const CURSEFORGE_OVERWOLF_UID = 'cchhcaiapeikjbdbpfplgmpobbcdkdaphclbmkbj'

export const CURSEFORGE_DOWNLOAD_URL = 'https://www.curseforge.com/download/app'

// Application OAuth GitHub pour « Se connecter avec GitHub » (flux par code, sans secret : l'identifiant est public).
// Tant qu'il est vide, la connexion se fait en collant un jeton.
export const GITHUB_OAUTH_CLIENT_ID = ''
