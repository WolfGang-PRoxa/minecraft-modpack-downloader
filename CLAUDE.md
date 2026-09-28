# CLAUDE.md

Application Windows (Electron) qui affiche les modpacks Minecraft publiés en releases sur
`WolfGang-PRoxa/minecraft-modpack-downloader` et les installe directement comme profils CurseForge.
Interface et messages en français.

## Règles git — impératif

- **Ne jamais mentionner Claude** dans les commits, PR, tags ou fichiers : pas de ligne
  `Co-Authored-By`, pas de « Generated with Claude Code », pas de Claude parmi les contributeurs.
  L'auteur des commits est celui de la config git locale.
- Messages de commit en français, au format conventionnel (`feat: …`, `fix: …`, `docs: …`).
- Ne pas créer de release ni pousser de tag sans demande explicite (un tag `app-v*` déclenche la CI).

## Commandes

```bash
npm run dev              # app en développement (HMR)
npm run typecheck        # tsc sur main/preload/scripts puis sur le renderer
npm run build            # typecheck + build electron-vite dans out/
npm run build:win        # installeur NSIS dans dist/
npm run publish:modpack  # publie une instance CurseForge en release (voir README)
npx tsx scripts/generate-icon.ts   # régénère build/icon.png depuis src/shared/logo.ts
```

## Architecture

- `src/main/` — processus principal
  - `github.ts` : lecture des releases (cache ETag sur disque, mode hors ligne), `modpack.json` via l'URL publique
    (hors quota API), détection de mise à jour de l'app (tags `app-v*`).
  - `installer.ts` : téléchargement → vérif SHA-256 → extraction dans un dossier de travail sur le même disque
    que `Instances` → basculement par renommage. Mise à jour sur place en conservant les données du joueur
    (`PLAYER_DATA`) et ses champs de `minecraftinstance.json` (`PRESERVED_INSTANCE_FIELDS`).
  - `curseforge.ts` : détection (protocole `curseforge://` dans `HKCR`, puis chemins connus Overwolf/autonome),
    lancement, dossier `Instances` (réglage > logs CurseForge > défaut), détection de Minecraft lancé.
  - `zip.ts` (yauzl, protection zip-slip, accepte un zip avec dossier racine), `download.ts`, `ipc.ts`, `appUpdate.ts`.
- `src/preload/` — expose `window.api` (type `RendererApi` dans `src/shared/types.ts`).
- `src/renderer/` — React 19 + Tailwind v4 + zustand (`store.ts`). Thème sombre unique.
- `src/shared/` — config du dépôt, types, parsing des releases, logo pixel-art (partagé avec le générateur d'icône).
- `scripts/publish-modpack.ts` — zippe une instance (exclusions `DEFAULT_EXCLUDES`), génère `modpack.json`,
  crée la release en brouillon, envoie les fichiers puis la publie (`make_latest: false`).
- `.github/workflows/release-app.yml` — build de l'installeur et release sur tag `app-vX.Y.Z`.

## Conventions de publication

- Release de modpack : tag `pack-<id>-v<version>`, fichiers `<id>-<version>.zip` (contenu du dossier d'instance,
  `minecraftinstance.json` à la racine), `modpack.json` (schéma `ModpackManifest`), `cover.(png|jpg|webp)` optionnel.
- Release de l'app : tag `app-v<version>` = version de `package.json`, avec l'installeur `.exe`.
- Chaque instance installée contient `.modpack-downloader.json` (id, version, `managedEntries`) : c'est la source
  de vérité pour savoir ce qui est installé.

## Faits CurseForge vérifiés

- CurseForge (Overwolf) pose un file watcher sur le dossier `Instances` et relit chaque `minecraftinstance.json` :
  pas besoin de le redémarrer. Il écrit le chemin du dossier dans ses logs
  (`%LOCALAPPDATA%\Overwolf\Log\Apps\CurseForge\CurseClient\*.json`, « Setting file watcher on instance directory »).
- Lancer CurseForge alors qu'il tourne déjà remet simplement sa fenêtre au premier plan.
- UID Overwolf de CurseForge : `cchhcaiapeikjbdbpfplgmpobbcdkdaphclbmkbj`.

## Pièges connus

- L'extension VS Code définit `ELECTRON_RUN_AS_NODE=1` : Electron démarre alors comme Node et plante
  (`app` undefined). Retirer cette variable pour lancer l'app depuis un outil.
- npm 11 n'exécute que les scripts d'install listés dans `allowScripts` (package.json). Electron télécharge son binaire
  au premier lancement.
- TypeScript est épinglé en 6.x (la 7 est le compilateur natif, pas encore validé ici). archiver 8 est en ESM
  (exports nommés `ZipArchive`). lucide-react v1 n'a plus d'icônes de marques. Tailwind v4 : `px-0!`, `bg-linear-to-r`.
- Tester sans GitHub : générer des releases avec `publish:modpack -- --dry-run --out <dossier>` et lancer l'app non
  packagée avec `MPD_GITHUB_API=http://localhost:<port>/repos/o/r` (surcharge ignorée dans l'app packagée).
  Mettre un dossier `Instances` de test dans les paramètres pour ne pas toucher au vrai CurseForge.
